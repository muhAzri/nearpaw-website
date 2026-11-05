import type { AuditRecorder } from "@/backend/shared/application/audit";
import { systemClock, type Clock } from "@/backend/shared/application/clock";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { ImpactAdmin, ImpactPublic } from "./application/impact.usecases";
import { InMemoryImpactRepository } from "./infrastructure/in-memory-impact.repository";
import { ImpactController } from "./presentation/impact.controller";

export function createImpactModule(deps: { auth: Authenticator; audit: AuditRecorder; clock?: Clock }) {
  const repo = singleton("impact_repo", () => new InMemoryImpactRepository());
  return {
    controller: new ImpactController(deps.auth, new ImpactPublic(repo), new ImpactAdmin(repo, deps.audit, deps.clock ?? systemClock)),
  };
}
