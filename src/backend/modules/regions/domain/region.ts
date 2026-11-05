import { ValidationError } from "@/backend/shared/domain/errors";
import { assertGeoPoint, distanceKm, type GeoPoint } from "@/backend/shared/domain/geo";

export type RegionStatus = "active" | "inactive";
export type Language = "en" | "id";

export interface Region {
  readonly id: string;
  readonly name: string;
  readonly status: RegionStatus;
  readonly languages: readonly Language[];
  readonly defaultExpiryDays: number;
  readonly supportContact: string | null;
  readonly center: GeoPoint;
  readonly radiusKm: number;
  readonly updatedAt: Date;
}

/** A region can go live only once a support contact and languages are set. */
export function assertActivatable(region: Region): void {
  if (!region.supportContact || region.languages.length === 0) {
    throw new ValidationError("Set a support contact and at least one language before activating the region", {
      supportContact: !!region.supportContact,
      languages: region.languages.length,
    });
  }
}

export function assertValidRegion(region: Region): void {
  assertGeoPoint(region.center);
  if (region.status === "active") assertActivatable(region);
}

/** Reports can only be created inside an active region's boundary. */
export function regionContains(region: Region, point: GeoPoint): boolean {
  return region.status === "active" && distanceKm(region.center, point) <= region.radiusKm;
}
