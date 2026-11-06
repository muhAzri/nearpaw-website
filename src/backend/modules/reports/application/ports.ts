import type { GeoPoint } from "@/backend/shared/domain/geo";

export interface ContributorDirectory {
  /** Throws when the account may not post (restricted, suspended, banned, deleted). */
  assertCanContribute(userId: string): Promise<void>;
  reporterSummary(userId: string): Promise<{ label: string; handle: number; status: string; accountAgeDays: number } | null>;
  blockedIds(viewerId: string): Promise<Set<string>>;
  block(blockerId: string, blockedId: string): Promise<void>;
  resolveHandle(handle: number): Promise<string | null>;
  sanction(userId: string, action: "warn" | "restrict"): Promise<void>;
  publicLabel(userId: string): Promise<string>;
}

export interface RegionDirectory {
  findActiveContaining(point: GeoPoint): Promise<{ id: string; name: string; defaultExpiryDays: number } | null>;
}

export interface LimitsReader {
  safetyLimits(): Promise<{ autoHideAfterFlags: number; reportsPerUserPerHour: number; updatesPerUserPerHour: number; reportExpiryDays: number }>;
  featureFlags(): Promise<{ communityUpdates: boolean; restrictToRegions: boolean }>;
}

export interface PublishedReport {
  id: string;
  ref: string;
  title: string;
  animal: string;
  urgency: string;
  location: GeoPoint;
  locationLabel: string | null;
  reporterId: string;
}

/** Outbound domain event; alerts subscribe in the composition root. */
export interface ReportEvents {
  published(report: PublishedReport): Promise<void>;
}

/** Deletes stored photo files (implemented by the media module via the composition root). Missing files are not an error. */
export interface PhotoEraser {
  deleteObjects(keys: readonly string[]): Promise<void>;
}
