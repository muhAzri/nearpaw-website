import { GoogleAuth } from "google-auth-library";
import type { PushNotifier, PushOutcome } from "../application/alerts.usecases";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

type Fetch = typeof fetch;

export interface FcmConfig {
  projectId: string;
  /** Returns a short-lived OAuth token for the FCM scope. */
  accessToken: () => Promise<string>;
  fetch?: Fetch;
}

/** Sends through Firebase Cloud Messaging (HTTP v1). One request per device; FCM relays to APNs for iPhones. */
export class FcmPushNotifier implements PushNotifier {
  private readonly fetchImpl: Fetch;

  constructor(private readonly config: FcmConfig) {
    this.fetchImpl = config.fetch ?? fetch;
  }

  async send(deviceTokens: string[], message: { title: string; body: string; data: Record<string, string> }): Promise<PushOutcome> {
    const bearer = await this.config.accessToken();
    const results = await Promise.all(deviceTokens.map((token) => this.sendOne(bearer, token, message)));
    return {
      delivered: results.some((r) => r === "sent"),
      invalidTokens: deviceTokens.filter((_, i) => results[i] === "invalid"),
    };
  }

  private async sendOne(bearer: string, token: string, message: { title: string; body: string; data: Record<string, string> }): Promise<"sent" | "invalid" | "failed"> {
    try {
      const res = await this.fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.config.projectId)}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: message.title, body: message.body },
            // FCM data values must be strings.
            data: message.data,
            apns: { headers: { "apns-priority": "10" }, payload: { aps: { sound: "default" } } },
          },
        }),
      });
      if (res.ok) return "sent";
      const body = (await res.json().catch(() => null)) as { error?: { status?: string; details?: { errorCode?: string }[] } } | null;
      const code = body?.error?.details?.find((d) => d.errorCode)?.errorCode ?? body?.error?.status;
      // UNREGISTERED / NOT_FOUND: the app was removed or the token rotated. INVALID_ARGUMENT: not a valid token.
      if (res.status === 404 || code === "UNREGISTERED" || code === "NOT_FOUND" || code === "INVALID_ARGUMENT") return "invalid";
      console.error(`[push] FCM rejected a message (${res.status} ${code ?? ""})`);
      return "failed";
    } catch (error) {
      console.error("[push] FCM request failed", error);
      return "failed";
    }
  }
}

/** Parses the service account JSON (raw or base64) and returns a project id plus an OAuth token provider. */
export function fcmFromServiceAccount(raw: string, projectIdOverride?: string): { projectId: string; accessToken: () => Promise<string> } {
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const credentials = JSON.parse(text) as { project_id?: string; client_email?: string; private_key?: string };
  if (!credentials.client_email || !credentials.private_key) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email or private_key");
  const projectId = projectIdOverride ?? credentials.project_id;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required when the service account JSON has no project_id");
  const auth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
  return {
    projectId,
    accessToken: async () => {
      const token = await auth.getAccessToken();
      if (!token) throw new Error("Could not get an FCM access token");
      return token;
    },
  };
}
