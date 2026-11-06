import { describe, expect, it } from "vitest";
import { AlertsService, type PushNotifier } from "../modules/alerts/application/alerts.usecases";
import { FcmPushNotifier, fcmFromServiceAccount } from "../modules/alerts/infrastructure/fcm-push-notifier";
import { InMemoryAlertRepository } from "./support/in-memory-alerts";

type Call = { url: string; init: RequestInit };
const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const fakeFetch = (respond: (token: string) => Response) => {
  const calls: Call[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return respond((JSON.parse(String(init?.body)) as { message: { token: string } }).message.token);
  }) as typeof fetch;
  return { impl, calls };
};

const notifier = (respond: (token: string) => Response) => {
  const f = fakeFetch(respond);
  return { calls: f.calls, push: new FcmPushNotifier({ projectId: "nearpaw-app", accessToken: async () => "oauth-token", fetch: f.impl }) };
};

const message = { title: "Nearpaw", body: "A new report was posted near Cilandak.", data: { ref: "RPT-7K2F9Q" } };

describe("FcmPushNotifier", () => {
  it("posts one HTTP v1 message per device with the calm copy, the report ref and an APNs sound", async () => {
    const { push, calls } = notifier(() => reply(200, { name: "projects/nearpaw-app/messages/1" }));
    const outcome = await push.send(["token-aaaaaaaaaa", "token-bbbbbbbbbb"], message);
    expect(outcome).toEqual({ delivered: true, invalidTokens: [] });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("https://fcm.googleapis.com/v1/projects/nearpaw-app/messages:send");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer oauth-token");
    const sent = JSON.parse(String(calls[0].init.body)).message;
    expect(sent).toMatchObject({
      token: "token-aaaaaaaaaa",
      notification: { title: "Nearpaw", body: "A new report was posted near Cilandak." },
      data: { ref: "RPT-7K2F9Q" },
      apns: { payload: { aps: { sound: "default" } } },
    });
    // FCM requires string-only data
    expect(Object.values(sent.data).every((v) => typeof v === "string")).toBe(true);
  });

  it("reports tokens that FCM says are dead so they can be forgotten", async () => {
    const { push } = notifier((token) =>
      token.startsWith("dead")
        ? reply(404, { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } })
        : reply(200),
    );
    expect(await push.send(["dead-token-111111", "live-token-222222"], message)).toEqual({ delivered: true, invalidTokens: ["dead-token-111111"] });
  });

  it("does not delete tokens on a transient failure", async () => {
    const { push } = notifier(() => reply(503, { error: { status: "UNAVAILABLE" } }));
    expect(await push.send(["token-aaaaaaaaaa"], message)).toEqual({ delivered: false, invalidTokens: [] });
  });

  it("survives a network error", async () => {
    const push = new FcmPushNotifier({ projectId: "p", accessToken: async () => "t", fetch: (async () => { throw new Error("socket hang up"); }) as unknown as typeof fetch });
    expect(await push.send(["token-aaaaaaaaaa"], message)).toEqual({ delivered: false, invalidTokens: [] });
  });
});

describe("fcmFromServiceAccount", () => {
  // A throwaway key pair, only for parsing; it never talks to Google.
  const json = JSON.stringify({ project_id: "nearpaw-app", client_email: "svc@nearpaw-app.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" });

  it("accepts raw or base64 JSON and takes the project id from it", () => {
    expect(fcmFromServiceAccount(json).projectId).toBe("nearpaw-app");
    expect(fcmFromServiceAccount(Buffer.from(json).toString("base64")).projectId).toBe("nearpaw-app");
  });

  it("lets FIREBASE_PROJECT_ID override and rejects incomplete credentials", () => {
    expect(fcmFromServiceAccount(json, "other-project").projectId).toBe("other-project");
    expect(() => fcmFromServiceAccount(JSON.stringify({ project_id: "x" }))).toThrow(/client_email or private_key/);
  });
});

describe("alert fan-out with push", () => {
  const report = { ref: "RPT-7K2F9Q", title: "Injured cat", animal: "cat", urgency: "high", location: { lat: -6.2615, lng: 106.8106 }, locationLabel: "Jl. Kemang Raya", reporterId: "someone-else" };

  const setup = async (push: PushNotifier) => {
    const repo = new InMemoryAlertRepository();
    const service = new AlertsService(repo, push, { alertsEnabled: async () => true, blockedIds: async () => new Set() }, { now: () => new Date("2026-11-06T10:00:00Z") });
    const user = { id: "u_dewi", role: "user" as const };
    await service.updateSettings(user, { enabled: true, area: { label: "Cilandak, South Jakarta", lat: -6.2906, lng: 106.7993 }, radiusKm: 10, animals: [] });
    await service.registerDevice(user, "live-token-222222");
    await service.registerDevice(user, "dead-token-111111");
    return { repo, service, user };
  };

  it("sends the calm copy and marks the alert as sent", async () => {
    const sent: { tokens: string[]; message: unknown }[] = [];
    const { service, user } = await setup({ send: async (tokens, m) => { sent.push({ tokens, message: m }); return { delivered: true, invalidTokens: [] }; } });
    await service.onReportPublished(report);
    expect(sent[0].message).toMatchObject({ title: "Nearpaw", body: "A new report was posted near Cilandak, South Jakarta.", data: { ref: "RPT-7K2F9Q" } });
    expect((await service.feed(user, { unreadOnly: false, limit: 10, offset: 0 })).items).toHaveLength(1);
  });

  it("forgets dead device tokens after a push", async () => {
    const { repo, service, user } = await setup({ send: async () => ({ delivered: true, invalidTokens: ["dead-token-111111"] }) });
    await service.onReportPublished(report);
    expect(await repo.devices(user.id)).toEqual(["live-token-222222"]);
  });

  it("never blocks publishing when the provider throws", async () => {
    const { repo, service, user } = await setup({ send: async () => { throw new Error("FCM down"); } });
    await expect(service.onReportPublished(report)).resolves.toBeUndefined();
    expect(await repo.devices(user.id)).toHaveLength(2);
    expect((await service.feed(user, { unreadOnly: false, limit: 10, offset: 0 })).items[0]).toBeDefined();
  });
});
