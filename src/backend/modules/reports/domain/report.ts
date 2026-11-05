import { ForbiddenError, NotFoundError, ValidationError } from "@/backend/shared/domain/errors";
import { assertGeoPoint, type GeoPoint } from "@/backend/shared/domain/geo";
import { generateReference } from "@/backend/shared/domain/reference";
import { publicText } from "@/backend/shared/domain/text";

export const ANIMALS = ["cat", "dog", "wildlife", "other"] as const;
export const CONDITIONS = ["injured", "sick", "abandoned", "trapped", "suspected_abuse", "other"] as const;
export const URGENCIES = ["low", "medium", "high"] as const;

export type Animal = (typeof ANIMALS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type Urgency = (typeof URGENCIES)[number];
export type ReportState = "live" | "hidden" | "closed" | "expired" | "removed";
export type HiddenBy = "auto" | "admin" | "owner";

export const URGENCY_RANK: Record<Urgency, number> = { low: 0, medium: 1, high: 2 };
export const MAX_PHOTOS = 4;

export interface Report {
  readonly id: string;
  /** Public reference, e.g. RPT-7K2F9Q. Used in URLs and shared links. */
  readonly ref: string;
  readonly reporterId: string;
  readonly animal: Animal;
  readonly condition: Condition;
  readonly urgency: Urgency;
  readonly description: string;
  readonly photos: readonly string[];
  /** The exact pin the reporter set; public by design. */
  readonly location: GeoPoint;
  readonly locationLabel: string | null;
  /** Set when the pin falls inside a configured region; reporting works everywhere regardless. */
  readonly regionId: string | null;
  /** Coarse, public area label (never the street). */
  readonly areaName: string | null;
  readonly language: "en" | "id";
  readonly state: ReportState;
  readonly hiddenBy: HiddenBy | null;
  readonly moderationReason: string | null;
  readonly duplicateOfRef: string | null;
  /** Unresolved flags from distinct people. */
  readonly openFlags: number;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly closedAt: Date | null;
}

export interface NewReport {
  reporterId: string;
  animal: Animal;
  condition: Condition;
  urgency: Urgency;
  description: string;
  photos: string[];
  location: GeoPoint;
  locationLabel?: string;
  language: "en" | "id";
  areaName?: string;
  region: { id: string; name: string } | null;
  expiryDays: number;
  now: Date;
}

export function validateDescription(raw: string): string {
  return publicText(raw, "Description", { min: 5, max: 500 });
}

export function createReport(input: NewReport): Report {
  assertGeoPoint(input.location);
  if (input.photos.length > MAX_PHOTOS) throw new ValidationError(`At most ${MAX_PHOTOS} photos`);
  return {
    id: crypto.randomUUID(),
    ref: generateReference("RPT"),
    reporterId: input.reporterId,
    animal: input.animal,
    condition: input.condition,
    urgency: input.urgency,
    description: validateDescription(input.description),
    photos: input.photos,
    location: input.location,
    locationLabel: input.locationLabel ? publicText(input.locationLabel, "Location label", { max: 120 }) : null,
    regionId: input.region?.id ?? null,
    areaName: input.areaName ? publicText(input.areaName, "Area", { max: 120 }) : (input.region?.name ?? null),
    language: input.language,
    state: "live",
    hiddenBy: null,
    moderationReason: null,
    duplicateOfRef: null,
    openFlags: 0,
    createdAt: input.now,
    expiresAt: new Date(input.now.getTime() + input.expiryDays * 86_400_000),
    closedAt: null,
  };
}

/** Reports expire automatically; no job needed to read the right answer. */
export function effectiveState(report: Report, now: Date): ReportState {
  return report.state === "live" && report.expiresAt <= now ? "expired" : report.state;
}

export const isPubliclyVisible = (report: Report, now: Date) => {
  const s = effectiveState(report, now);
  return s === "live" || s === "closed";
};

export function reportTitle(report: Pick<Report, "animal" | "condition">): string {
  const animal = report.animal === "other" ? "animal" : report.animal;
  switch (report.condition) {
    case "suspected_abuse":
      return `Suspected abuse · ${animal}`;
    case "other":
      return `${animal[0].toUpperCase()}${animal.slice(1)} in need`;
    default: {
      const c = report.condition;
      return `${c[0].toUpperCase()}${c.slice(1)} ${animal}`;
    }
  }
}

export function edit(
  report: Report,
  patch: { description?: string; urgency?: Urgency; condition?: Condition },
  now: Date,
): Report {
  if (effectiveState(report, now) !== "live") throw new ForbiddenError("Only live reports can be edited");
  return {
    ...report,
    description: patch.description === undefined ? report.description : validateDescription(patch.description),
    urgency: patch.urgency ?? report.urgency,
    condition: patch.condition ?? report.condition,
  };
}

export function close(report: Report, now: Date): Report {
  if (effectiveState(report, now) !== "live") throw new ForbiddenError("Only live reports can be closed");
  return { ...report, state: "closed", closedAt: now };
}

export function hide(report: Report, by: HiddenBy, reason: string, duplicateOfRef: string | null = null): Report {
  if (report.state === "removed") throw new ForbiddenError("This report was removed");
  return { ...report, state: "hidden", hiddenBy: by, moderationReason: reason, duplicateOfRef };
}

/** "Keep live": a moderator reviewed it and it stays up (until it expires). */
export function restore(report: Report): Report {
  if (report.state === "removed") throw new ForbiddenError("This report was removed");
  if (report.state === "closed") return report;
  return { ...report, state: "live", hiddenBy: null, moderationReason: null, duplicateOfRef: null };
}

export function remove(report: Report, by: HiddenBy, reason: string): Report {
  return { ...report, state: "removed", hiddenBy: by, moderationReason: reason };
}

export function withOpenFlags<T extends { openFlags: number }>(item: T, openFlags: number): T {
  return { ...item, openFlags };
}

export function assertFound<T>(value: T | null | undefined, what = "Report"): T {
  if (!value) throw new NotFoundError(`${what} not found`);
  return value;
}
