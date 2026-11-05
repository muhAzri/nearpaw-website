import { z } from "zod";

export const PeriodInputSchema = z.object({
  label: z.string().trim().min(2).max(40),
  summary: z.string().trim().max(2000).default(""),
});

export const AllocationInputSchema = z.object({
  beneficiary: z.string().trim().min(2).max(120),
  category: z.enum(["shelter", "rescue_group", "vet_clinic", "other"]),
  amount: z.number().positive().max(1_000_000_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  transferDate: z.coerce.date(),
  publicNote: z.string().trim().max(1000).default(""),
  /** Redacted evidence files, as storage keys. Never bank details. */
  evidence: z.array(z.string().regex(/^evidence\/[A-Za-z0-9/_.-]{1,180}$/)).max(10).default([]),
  redactionChecked: z.boolean().default(false),
});
export type AllocationInput = z.infer<typeof AllocationInputSchema>;

export const AllocationPatchSchema = AllocationInputSchema.partial().extend({
  transferConfirmed: z.boolean().optional(),
});

export const AllocationStageSchema = z.object({ to: z.enum(["verified", "published", "draft"]) });
export const PeriodPublishSchema = z.object({ published: z.boolean() });
