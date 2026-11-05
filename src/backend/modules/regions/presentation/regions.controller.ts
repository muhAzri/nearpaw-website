import {
  AdPlacementPatchSchema,
  AppConfigPatchSchema,
  RegionInputSchema,
  RegionPatchSchema,
} from "@/contracts";
import { z } from "zod";
import { requireAdmin, type Authenticator } from "@/backend/shared/presentation/auth";
import { created, noContent, ok, parseJson, parseQuery } from "@/backend/shared/presentation/http";
import type { AdPlacementAdmin, ConfigAdmin, RegionAdmin, RegionQueries } from "../application/region.usecases";

const PublicConfigQuery = z.object({ regionId: z.uuid().optional() });

export class RegionsController {
  constructor(
    private readonly auth: Authenticator,
    private readonly queries: RegionQueries,
    private readonly regions: RegionAdmin,
    private readonly config: ConfigAdmin,
    private readonly placements: AdPlacementAdmin,
  ) {}

  // ---- public ----
  publicConfig = async (request: Request) =>
    ok(await this.queries.publicConfig(parseQuery(request, PublicConfigQuery).regionId));

  publicRegions = async () => ok(await this.queries.activeRegions());

  // ---- admin ----
  listRegions = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.regions.list());
  };

  getRegion = async (request: Request, id: string) => {
    await requireAdmin(request, this.auth);
    return ok(await this.regions.get(id));
  };

  createRegion = async (request: Request) => {
    const admin = await requireAdmin(request, this.auth);
    return created(await this.regions.create(admin, await parseJson(request, RegionInputSchema)));
  };

  updateRegion = async (request: Request, id: string) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.regions.update(admin, id, await parseJson(request, RegionPatchSchema)));
  };

  getConfig = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.config.get());
  };

  updateConfig = async (request: Request) => {
    const admin = await requireAdmin(request, this.auth);
    return ok(await this.config.update(admin, await parseJson(request, AppConfigPatchSchema)));
  };

  listPlacements = async (request: Request) => {
    await requireAdmin(request, this.auth);
    return ok(await this.placements.list());
  };

  setPlacement = async (request: Request, placementId: string) => {
    const admin = await requireAdmin(request, this.auth);
    const body = await parseJson(request, AdPlacementPatchSchema);
    await this.placements.set(admin, placementId, body.regionId, body.enabled);
    return noContent();
  };
}
