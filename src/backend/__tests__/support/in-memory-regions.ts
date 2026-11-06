import { DEFAULT_APP_CONFIG, type AppConfig } from "../../modules/regions/domain/app-config";
import type { Region } from "../../modules/regions/domain/region";
import type { AdPlacementRepository, ConfigRepository, RegionRepository } from "../../modules/regions/domain/repositories";

export class InMemoryRegionRepository implements RegionRepository {
  // Starts empty: regions are optional overrides the operator adds if and when needed.
  private readonly items = new Map<string, Region>();

  async list() {
    return [...this.items.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async save(region: Region) {
    this.items.set(region.id, region);
  }
}

export class InMemoryConfigRepository implements ConfigRepository {
  private config: AppConfig = structuredClone(DEFAULT_APP_CONFIG);
  async get() {
    return structuredClone(this.config);
  }
  async save(config: AppConfig) {
    this.config = structuredClone(config);
  }
}

export class InMemoryAdPlacementRepository implements AdPlacementRepository {
  private readonly enabled = new Map<string, Set<string>>();
  async enabledRegionIds(placementId: string) {
    return [...(this.enabled.get(placementId) ?? [])];
  }
  async set(placementId: string, regionId: string, on: boolean) {
    const set = this.enabled.get(placementId) ?? new Set<string>();
    if (on) set.add(regionId);
    else set.delete(regionId);
    this.enabled.set(placementId, set);
  }
}
