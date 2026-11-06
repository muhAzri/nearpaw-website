import type { AuditRecorder } from "@/backend/shared/application/audit";
import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { ImpactAdmin, ImpactPublic } from "./application/impact.usecases";
import type { ImpactRepository } from "./domain/repositories";
import { ImpactController } from "./presentation/impact.controller";

export function createImpactModule(deps: { auth: Authenticator; audit: AuditRecorder; repo: ImpactRepository; clock?: Clock }) {
  const repo = deps.repo;
  return {
    controller: new ImpactController(deps.auth, new ImpactPublic(repo), new ImpactAdmin(repo, deps.audit, deps.clock ?? systemClock)),
  };
}
