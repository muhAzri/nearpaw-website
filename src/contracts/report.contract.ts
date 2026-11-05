import { z } from "zod";
import {
  AnimalSchema,
  ConditionSchema,
  FlagReasonSchema,
  FlagTargetSchema,
  LanguageSchema,
  ReportStateSchema,
  UpdateTypeSchema,
  UrgencySchema,
} from "./enums";

/** Storage keys written by the media pipeline (EXIF already stripped under `public/`). */
const PhotoKeySchema = z.string().regex(/^public\/[A-Za-z0-9/_.-]{1,180}$/);

export const CreateReportSchema = z.object({
  animal: AnimalSchema,
  condition: ConditionSchema,
  urgency: UrgencySchema,
  description: z.string().min(1).max(600),
  photos: z.array(PhotoKeySchema).max(4).default([]),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  /** Human-readable pin label, e.g. "Jl. Kemang Raya, Cilandak". */
  locationLabel: z.string().trim().max(120).optional(),
  /** Coarse area from the device's reverse geocoding, e.g. "Cilandak, South Jakarta". Shown on shared links. */
  areaName: z.string().trim().max(120).optional(),
  language: LanguageSchema.default("en"),
  consent: z.literal(true, { error: "Consent is required to submit a report" }),
});
export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export const EditReportSchema = z
  .object({
    description: z.string().min(1).max(600),
    urgency: UrgencySchema,
    condition: ConditionSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");

const csv = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.split(",").filter(Boolean) : v), z.array(item).optional());

export const ListReportsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.5).max(100).default(5),
  sort: z.enum(["nearby", "latest", "urgent"]).default("nearby"),
  animal: csv(AnimalSchema),
  condition: csv(ConditionSchema),
  /** Reported within N days (omit = all active). */
  sinceDays: z.coerce.number().int().min(1).max(60).optional(),
  state: z.enum(["live", "closed"]).default("live"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const AddUpdateSchema = z.object({
  type: UpdateTypeSchema,
  note: z.string().max(140).optional(),
  photos: z.array(PhotoKeySchema).max(1).default([]),
});

export const CreateFlagSchema = z.object({
  targetType: FlagTargetSchema,
  /** Report ref (RPT-…), update id, or user public id. */
  targetId: z.string().min(1).max(64),
  reason: FlagReasonSchema,
  details: z.string().trim().max(500).optional(),
  alsoBlock: z.boolean().default(false),
});

// ---------- admin ----------

export const AdminReportsQuerySchema = z.object({
  q: z.string().trim().max(20).optional(),
  state: ReportStateSchema.optional(),
  regionId: z.uuid().optional(),
  animal: AnimalSchema.optional(),
  urgency: UrgencySchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(["newest", "most_flags"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ReportDecisionSchema = z.object({
  decision: z.enum(["keep", "duplicate", "hide", "remove"]),
  reason: z.string().trim().min(3).max(500),
  /** Required for `duplicate`: the ref of the report to keep. */
  duplicateOf: z.string().regex(/^RPT-[A-Z0-9]{6}$/).optional(),
});

export const AdminUpdatesQuerySchema = z.object({
  filter: z.enum(["flagged", "all", "hidden"]).default("flagged"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const UpdateDecisionSchema = z.object({
  decision: z.enum(["hide", "keep"]),
  reason: z.string().trim().min(3).max(500),
});

export const AdminFlagsQuerySchema = z.object({
  status: z.enum(["open", "resolved"]).default("open"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ResolveFlagSchema = z.object({
  outcome: z.enum(["none", "hide", "warn", "restrict"]),
  notes: z.string().trim().min(3).max(1000),
});
