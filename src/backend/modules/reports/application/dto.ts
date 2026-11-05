import { distanceKm, type GeoPoint } from "@/backend/shared/domain/geo";
import type { CommunityUpdate } from "../domain/community-update";
import { effectiveState, reportTitle, type Report } from "../domain/report";

export function toSummary(report: Report, now: Date, opts: { from?: GeoPoint; updateCount?: number; mine?: boolean }) {
  return {
    ref: report.ref,
    title: reportTitle(report),
    animal: report.animal,
    condition: report.condition,
    urgency: report.urgency,
    state: effectiveState(report, now),
    location: report.location,
    locationLabel: report.locationLabel,
    region: report.areaName,
    distanceKm: opts.from ? Math.round(distanceKm(opts.from, report.location) * 100) / 100 : null,
    thumbnail: report.photos[0] ?? null,
    updateCount: opts.updateCount ?? 0,
    mine: opts.mine ?? false,
    createdAt: report.createdAt.toISOString(),
  };
}

export const toUpdateDto = (u: CommunityUpdate) => ({
  id: u.id,
  type: u.type,
  note: u.note,
  photos: u.photos,
  label: "Community update" as const,
  verified: false,
  createdAt: u.createdAt.toISOString(),
});

export type ReportSummaryDto = ReturnType<typeof toSummary>;
