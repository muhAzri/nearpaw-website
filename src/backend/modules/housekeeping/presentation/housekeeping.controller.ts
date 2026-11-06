import { errorResponse, ok } from "@/backend/shared/presentation/http";
import type { Housekeeping } from "../application/housekeeping.usecases";

/** Constant-time comparison, so response timing doesn't reveal how much of the secret matched. */
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** `GET /api/v1/cron/housekeeping`, called by Vercel Cron with `Authorization: Bearer <CRON_SECRET>`. */
export class HousekeepingController {
  constructor(
    private readonly secret: () => string | undefined,
    private readonly job: Housekeeping,
  ) {}

  async run(request: Request): Promise<Response> {
    const secret = this.secret();
    // No secret configured means nobody can be trusted to call this: refuse rather than run open.
    if (!secret) return errorResponse(503, "SERVICE_UNAVAILABLE", "Housekeeping is not configured.");
    const bearer = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!bearer || !sameSecret(bearer, secret)) return errorResponse(401, "UNAUTHORIZED", "Unauthorized");

    const tasks = await this.job.run();
    return ok({ tasks }, tasks.every((t) => t.ok) ? 200 : 500);
  }
}
