import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { AdPlacementAdmin, ConfigAdmin, RegionAdmin, RegionQueries } from "./application/region.usecases";
import type { AdPlacementRepository, ConfigRepository, RegionRepository } from "./domain/repositories";
import { RegionsController } from "./presentation/regions.controller";

export function createRegionsModule(deps: {
  auth: Authenticator;
  audit: AuditRecorder;
  repos: { regions: RegionRepository; config: ConfigRepository; placements: AdPlacementRepository };
  clock?: Clock;
  mediaBaseUrl?: string;
}) {
  const { regions: regionRepo, config: configRepo, placements: placementRepo } = deps.repos;

  const queries = new RegionQueries(regionRepo, configRepo, placementRepo, deps.mediaBaseUrl?.replace(/\/+$/, "") ?? null);
  return {
    /** Read-side port consumed by other modules. */
    queries,
    controller: new RegionsController(
      deps.auth,
      queries,
      new RegionAdmin(regionRepo, deps.audit, deps.clock ?? systemClock),
      new ConfigAdmin(configRepo, deps.audit),
      new AdPlacementAdmin(regionRepo, placementRepo, deps.audit),
    ),
  };
}
