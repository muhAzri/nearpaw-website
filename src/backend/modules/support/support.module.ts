import type { AuditRecorder } from "@/backend/shared/application/audit";
import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { SupportAdmin, SupportPublic, type Mailer } from "./application/support.usecases";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import type { SupportRepository } from "./domain/repositories";
import { UnconfiguredMailer } from "./infrastructure/unconfigured-mailer";
import { SupportController } from "./presentation/support.controller";

export function createSupportModule(deps: { auth: Authenticator; audit: AuditRecorder; repo: SupportRepository; limiter: RateLimiter; mailer?: Mailer; clock?: Clock }) {
  const clock = deps.clock ?? systemClock;
  const repo = deps.repo;
  const admin = new SupportAdmin(repo, deps.mailer ?? new UnconfiguredMailer(), deps.audit, clock);
  return {
    counts: () => admin.counts(),
    controller: new SupportController(deps.auth, new SupportPublic(repo, deps.limiter, clock), admin),
  };
}
