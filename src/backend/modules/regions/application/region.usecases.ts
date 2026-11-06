import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Clock } from "@/backend/shared/application/clock";
import { NotFoundError } from "@/backend/shared/domain/errors";
import { actorOf, type Principal } from "@/backend/shared/domain/principal";
import { AD_PLACEMENTS, findPlacement } from "../domain/ad-placement";
import type { AppConfig } from "../domain/app-config";
import { assertValidRegion, regionContains, type Language, type Region, type RegionStatus } from "../domain/region";
import type { AdPlacementRepository, ConfigRepository, RegionRepository } from "../domain/repositories";
import { ValidationError } from "@/backend/shared/domain/errors";

/** Placement switch that applies everywhere, regions or not. */
export const GLOBAL_SCOPE = "*";

export interface RegionDto {
  id: string;
  name: string;
  status: RegionStatus;
  languages: Language[];
  defaultExpiryDays: number;
  supportContact: string | null;
  center: { lat: number; lng: number };
  radiusKm: number;
}

const toDto = (r: Region): RegionDto => ({
  id: r.id,
  name: r.name,
  status: r.status,
  languages: [...r.languages],
  defaultExpiryDays: r.defaultExpiryDays,
  supportContact: r.supportContact,
  center: r.center,
  radiusKm: r.radiusKm,
});

export interface RegionInputDto {
  name: string;
  languages: Language[];
  defaultExpiryDays: number;
  supportContact: string | null;
  center: { lat: number; lng: number };
  radiusKm: number;
}

export class RegionAdmin {
  constructor(
    private readonly regions: RegionRepository,
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
  ) {}

  async list(): Promise<RegionDto[]> {
    return (await this.regions.list()).map(toDto);
  }

  async get(id: string): Promise<RegionDto> {
    const region = await this.regions.findById(id);
    if (!region) throw new NotFoundError("Region not found");
    return toDto(region);
  }

  async create(admin: Principal, input: RegionInputDto): Promise<RegionDto> {
    const region: Region = {
      id: crypto.randomUUID(),
      ...input,
      status: "inactive",
      updatedAt: this.clock.now(),
    };
    assertValidRegion(region);
    await this.regions.save(region);
    await this.audit.record({ actor: actorOf(admin), action: "region.create", target: region.name });
    return toDto(region);
  }

  async update(
    admin: Principal,
    id: string,
    patch: Partial<RegionInputDto> & { status?: RegionStatus },
  ): Promise<RegionDto> {
    const current = await this.regions.findById(id);
    if (!current) throw new NotFoundError("Region not found");
    const next: Region = { ...current, ...patch, updatedAt: this.clock.now() };
    assertValidRegion(next);
    await this.regions.save(next);
    const activation = patch.status && patch.status !== current.status;
    await this.audit.record({
      actor: actorOf(admin),
      action: activation ? `region.${patch.status === "active" ? "activate" : "deactivate"}` : "region.update",
      target: next.name,
    });
    return toDto(next);
  }
}

export class ConfigAdmin {
  constructor(
    private readonly config: ConfigRepository,
    private readonly audit: AuditRecorder,
  ) {}

  get(): Promise<AppConfig> {
    return this.config.get();
  }

  async update(admin: Principal, patch: Partial<{ featureFlags: Partial<AppConfig["featureFlags"]>; safetyLimits: Partial<AppConfig["safetyLimits"]> }>) {
    const current = await this.config.get();
    const next: AppConfig = {
      featureFlags: { ...current.featureFlags, ...patch.featureFlags },
      safetyLimits: { ...current.safetyLimits, ...patch.safetyLimits },
    };
    await this.config.save(next);
    const changed = [...Object.keys(patch.featureFlags ?? {}), ...Object.keys(patch.safetyLimits ?? {})].join(",");
    await this.audit.record({ actor: actorOf(admin), action: "config.update", target: "app-config", metadata: { changed } });
    return next;
  }
}

export class AdPlacementAdmin {
  constructor(
    private readonly regions: RegionRepository,
    private readonly placements: AdPlacementRepository,
    private readonly audit: AuditRecorder,
  ) {}

  async list() {
    const regions = await this.regions.list();
    return Promise.all(
      AD_PLACEMENTS.map(async (p) => {
        const enabled = new Set(await this.placements.enabledRegionIds(p.id));
        return {
          ...p,
          global: !p.locked && enabled.has(GLOBAL_SCOPE),
          regions: regions.map((r) => ({ regionId: r.id, regionName: r.name, enabled: !p.locked && enabled.has(r.id) })),
        };
      }),
    );
  }

  async set(admin: Principal, placementId: string, regionId: string | undefined, enabled: boolean) {
    const placement = findPlacement(placementId);
    if (!placement) throw new NotFoundError("Placement not found");
    if (placement.locked && enabled) throw new ValidationError("This placement is locked and cannot be enabled");
    const region = regionId ? await this.regions.findById(regionId) : null;
    if (regionId && !region) throw new NotFoundError("Region not found");
    await this.placements.set(placementId, regionId ?? GLOBAL_SCOPE, enabled);
    await this.audit.record({
      actor: actorOf(admin),
      action: "ad_placement.set",
      target: `${placementId}@${region?.name ?? "global"}`,
      metadata: { enabled },
    });
  }
}

/** Read side used by the app and by other modules (through ports). */
export class RegionQueries {
  constructor(
    private readonly regions: RegionRepository,
    private readonly config: ConfigRepository,
    private readonly placements: AdPlacementRepository,
    /** Where `public/…` photo keys are served from; null until storage is configured. */
    private readonly mediaBaseUrl: string | null = null,
  ) {}

  async findActiveContaining(point: { lat: number; lng: number }) {
    const hit = (await this.regions.list()).find((r) => regionContains(r, point));
    return hit ? { id: hit.id, name: hit.name, defaultExpiryDays: hit.defaultExpiryDays } : null;
  }

  async findById(id: string) {
    const r = await this.regions.findById(id);
    return r ? { id: r.id, name: r.name } : null;
  }

  async safetyLimits() {
    return (await this.config.get()).safetyLimits;
  }

  async featureFlags() {
    return (await this.config.get()).featureFlags;
  }

  async activeRegions(): Promise<RegionDto[]> {
    return (await this.regions.list()).filter((r) => r.status === "active").map(toDto);
  }

  /** What the iOS app needs at launch. */
  async publicConfig(regionId?: string) {
    const config = await this.config.get();
    const ads: Record<string, boolean> = {};
    for (const p of AD_PLACEMENTS.filter((p) => !p.locked)) {
      const scopes = await this.placements.enabledRegionIds(p.id);
      const enabledHere = scopes.includes(GLOBAL_SCOPE) || (!!regionId && scopes.includes(regionId));
      const flag = p.id === "list_feed_native" ? config.featureFlags.listAds : config.featureFlags.impactBannerAd;
      ads[p.id] = enabledHere && flag;
    }
    return {
      minimumAppVersion: config.safetyLimits.minimumAppVersion,
      featureFlags: config.featureFlags,
      regions: await this.activeRegions(),
      mediaBaseUrl: this.mediaBaseUrl,
      ads,
    };
  }
}

