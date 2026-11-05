import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import { AuditService, ListAudit, RecentAudit } from "./application/audit.usecases";
import { InMemoryAuditRepository } from "./infrastructure/in-memory-audit.repository";
import { AuditController } from "./presentation/audit.controller";

export function createAuditModule(deps: { auth: Authenticator; clock?: Clock }) {
  const repo = singleton("audit_repo", () => new InMemoryAuditRepository());
  const service = new AuditService(repo, deps.clock ?? systemClock);
  const list = new ListAudit(repo);
  return {
    recorder: service,
    recent: new RecentAudit(repo),
    controller: new AuditController(deps.auth, list),
  };
}
