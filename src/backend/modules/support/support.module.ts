import type { AuditRecorder } from "@/backend/shared/application/audit";
import { systemClock, type Clock } from "@/backend/shared/application/clock";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import { sharedRateLimiter } from "@/backend/shared/infrastructure/rate-limiter";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { SupportAdmin, SupportPublic, type Mailer } from "./application/support.usecases";
import { InMemorySupportRepository, UnconfiguredMailer } from "./infrastructure/in-memory-support.repository";
import { SupportController } from "./presentation/support.controller";

export function createSupportModule(deps: { auth: Authenticator; audit: AuditRecorder; mailer?: Mailer; clock?: Clock }) {
  const clock = deps.clock ?? systemClock;
  const repo = singleton("support_repo", () => new InMemorySupportRepository());
  const admin = new SupportAdmin(repo, deps.mailer ?? new UnconfiguredMailer(), deps.audit, clock);
  return {
    counts: () => admin.counts(),
    controller: new SupportController(deps.auth, new SupportPublic(repo, sharedRateLimiter(), clock), admin),
  };
}
