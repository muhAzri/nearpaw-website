import { distanceKm, type GeoPoint } from "@/backend/shared/domain/geo";

export const ALERT_RADII = [2, 5, 10, 25] as const;
export type AlertRadius = (typeof ALERT_RADII)[number];

export interface AlertSettings {
  readonly userId: string;
  readonly enabled: boolean;
  readonly area: { label: string; lat: number; lng: number } | null;
  readonly radiusKm: AlertRadius;
  /** Empty = every animal. */
  readonly animals: readonly string[];
}

export const defaultSettings = (userId: string): AlertSettings => ({
  userId,
  enabled: false,
  area: null,
  radiusKm: 5,
  animals: [],
});

export interface AlertItem {
  readonly id: string;
  readonly userId: string;
  readonly reportRef: string;
  readonly title: string;
  readonly urgency: string;
  readonly locationLabel: string | null;
  /** Distance from the user's saved alert area, not from where they are. */
  readonly distanceKm: number;
  readonly read: boolean;
  readonly delivery: "sent" | "failed" | "skipped";
  readonly createdAt: Date;
}

export interface ReportForAlert {
  ref: string;
  title: string;
  animal: string;
  urgency: string;
  location: GeoPoint;
  locationLabel: string | null;
  reporterId: string;
}

/** Returns the distance when the report falls inside the user's alert area, otherwise null. */
export function matchDistance(settings: AlertSettings, report: ReportForAlert): number | null {
  if (!settings.enabled || !settings.area || settings.userId === report.reporterId) return null;
  if (settings.animals.length > 0 && !settings.animals.includes(report.animal)) return null;
  const d = distanceKm(settings.area, report.location);
  return d <= settings.radiusKm ? d : null;
}
