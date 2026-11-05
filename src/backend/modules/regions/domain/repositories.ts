import type { AppConfig } from "./app-config";
import type { Region } from "./region";

export interface RegionRepository {
  list(): Promise<Region[]>;
  findById(id: string): Promise<Region | null>;
  save(region: Region): Promise<void>;
}

export interface ConfigRepository {
  get(): Promise<AppConfig>;
  save(config: AppConfig): Promise<void>;
}

export interface AdPlacementRepository {
  enabledRegionIds(placementId: string): Promise<string[]>;
  set(placementId: string, regionId: string, enabled: boolean): Promise<void>;
}
