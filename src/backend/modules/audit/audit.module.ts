import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { AuditService, ListAudit, RecentAudit } from "./application/audit.usecases";
import type { AuditRepository } from "./domain/audit-record";
import { AuditController } from "./presentation/audit.controller";

export function createAuditModule(deps: { auth: Authenticator; repo: AuditRepository; clock?: Clock }) {
  const repo = deps.repo;
  const service = new AuditService(repo, deps.clock ?? systemClock);
  const list = new ListAudit(repo);
  return {
    recorder: service,
    recent: new RecentAudit(repo),
    controller: new AuditController(deps.auth, list),
  };
}
