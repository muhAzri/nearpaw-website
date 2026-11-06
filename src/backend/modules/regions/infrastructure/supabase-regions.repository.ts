import type { SupabaseClient } from "@supabase/supabase-js";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import { DEFAULT_APP_CONFIG, type AppConfig } from "../domain/app-config";
import type { Language, Region } from "../domain/region";
import type { AdPlacementRepository, ConfigRepository, RegionRepository } from "../domain/repositories";

export interface RegionRow {
  id: string;
  name: string;
  status: Region["status"];
  languages: Language[];
  default_expiry_days: number;
  support_contact: string | null;
  center_lat: number;
  center_lng: number;
  radius_km: number;
  updated_at: string;
}

export const regionFromRow = (r: RegionRow): Region => ({
  id: r.id,
  name: r.name,
  status: r.status,
  languages: r.languages,
  defaultExpiryDays: r.default_expiry_days,
  supportContact: r.support_contact,
  center: { lat: r.center_lat, lng: r.center_lng },
  radiusKm: r.radius_km,
  updatedAt: new Date(r.updated_at),
});

export const regionToRow = (r: Region): RegionRow => ({
  id: r.id,
  name: r.name,
  status: r.status,
  languages: [...r.languages],
  default_expiry_days: r.defaultExpiryDays,
  support_contact: r.supportContact,
  center_lat: r.center.lat,
  center_lng: r.center.lng,
  radius_km: r.radiusKm,
  updated_at: r.updatedAt.toISOString(),
});

/** `regions` table through the secret key. */
export class SupabaseRegionRepository implements RegionRepository {
  constructor(private readonly db: SupabaseClient) {}

  async list() {
    const rows = unwrap(await this.db.from("regions").select("*").order("name"), "regions.list");
    return (rows as RegionRow[]).map(regionFromRow);
  }
  async findById(id: string) {
    const row = unwrap(await this.db.from("regions").select("*").eq("id", id).maybeSingle<RegionRow>(), "regions.findById");
    return row ? regionFromRow(row) : null;
  }
  async save(region: Region) {
    check(await this.db.from("regions").upsert(regionToRow(region), { onConflict: "id" }), "regions.save");
  }
}

/** Singleton `app_config` row; anything missing from it falls back to the defaults. */
export class SupabaseConfigRepository implements ConfigRepository {
  constructor(private readonly db: SupabaseClient) {}

  async get(): Promise<AppConfig> {
    const row = unwrap(
      await this.db.from("app_config").select("feature_flags, safety_limits").eq("id", true).maybeSingle<{ feature_flags: Partial<AppConfig["featureFlags"]>; safety_limits: Partial<AppConfig["safetyLimits"]> }>(),
      "config.get",
    );
    return {
      featureFlags: { ...DEFAULT_APP_CONFIG.featureFlags, ...row?.feature_flags },
      safetyLimits: { ...DEFAULT_APP_CONFIG.safetyLimits, ...row?.safety_limits },
    };
  }
  async save(config: AppConfig) {
    check(await this.db.from("app_config").upsert({ id: true, feature_flags: config.featureFlags, safety_limits: config.safetyLimits }, { onConflict: "id" }), "config.save");
  }
}

const GLOBAL_SCOPE = "*"; // region_id is null in the table

/** `ad_placement_regions` table through the secret key. A null region means "everywhere". */
export class SupabaseAdPlacementRepository implements AdPlacementRepository {
  constructor(private readonly db: SupabaseClient) {}

  async enabledRegionIds(placementId: string) {
    const rows = unwrap(await this.db.from("ad_placement_regions").select("region_id").eq("placement_id", placementId), "placements.enabled");
    return (rows as { region_id: string | null }[]).map((r) => r.region_id ?? GLOBAL_SCOPE);
  }

  async set(placementId: string, regionId: string, enabled: boolean) {
    // The unique index is on an expression, so upsert is not available: remove the row, then add it back if enabled.
    const scope = this.db.from("ad_placement_regions").delete().eq("placement_id", placementId);
    check(await (regionId === GLOBAL_SCOPE ? scope.is("region_id", null) : scope.eq("region_id", regionId)), "placements.clear");
    if (enabled) {
      check(await this.db.from("ad_placement_regions").insert({ placement_id: placementId, region_id: regionId === GLOBAL_SCOPE ? null : regionId }), "placements.enable");
    }
  }
}
