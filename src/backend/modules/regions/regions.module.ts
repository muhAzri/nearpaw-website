import { systemClock, type Clock } from "@/backend/shared/application/clock";
import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Authenticator } from "@/backend/shared/presentation/auth";
import { singleton } from "@/backend/shared/infrastructure/singleton";
import { AdPlacementAdmin, ConfigAdmin, RegionAdmin, RegionQueries } from "./application/region.usecases";
import {
  InMemoryAdPlacementRepository,
  InMemoryConfigRepository,
  InMemoryRegionRepository,
} from "./infrastructure/in-memory.repositories";
import { RegionsController } from "./presentation/regions.controller";

export function createRegionsModule(deps: { auth: Authenticator; audit: AuditRecorder; clock?: Clock; mediaBaseUrl?: string }) {
  const regionRepo = singleton("regions_repo", () => new InMemoryRegionRepository());
  const configRepo = singleton("config_repo", () => new InMemoryConfigRepository());
  const placementRepo = singleton("placements_repo", () => new InMemoryAdPlacementRepository());

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
