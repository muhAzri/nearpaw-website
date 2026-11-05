import { z } from "zod";
import { AnimalSchema, ConditionSchema, ReportStateSchema, UrgencySchema } from "@/contracts";

/** Shapes of what `/api/v1/admin/*` answers. Requests are validated by the shared contracts. */

export const SessionSchema = z.object({ token: z.string(), expiresInSeconds: z.number(), role: z.literal("admin") });

export const Page = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), total: z.number() });

export const AuditEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  actor: z.enum(["Admin", "System"]),
  action: z.string(),
  target: z.string(),
  reason: z.string().nullable(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const DashboardSchema = z.object({
  liveReports: z.number(),
  reportsLast24h: z.number(),
  openFlags: z.number(),
  oldestOpenFlagMinutes: z.number().nullable(),
  autoHiddenToday: z.number(),
  alerts24h: z.object({ sent: z.number(), failed: z.number() }),
  newestReports: z.array(
    z.object({
      ref: z.string(),
      title: z.string(),
      region: z.string().nullable(),
      urgency: UrgencySchema,
      createdAt: z.string(),
    }),
  ),
  needsAttention: z.object({
    reportsWithMultipleFlags: z.number(),
    privacyRequestsDueSoon: z.number(),
    unreadSupportMessages: z.number(),
  }),
  recentActions: z.array(AuditEntrySchema),
});

export const ReportRowSchema = z.object({
  ref: z.string(),
  title: z.string(),
  region: z.string().nullable(),
  urgency: UrgencySchema,
  state: ReportStateSchema,
  hiddenBy: z.string().nullable(),
  flags: z.number(),
  createdAt: z.string(),
});
export type ReportRow = z.infer<typeof ReportRowSchema>;

export const ReportReviewSchema = ReportRowSchema.extend({
  animal: AnimalSchema,
  condition: ConditionSchema,
  description: z.string(),
  language: z.string(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  locationLabel: z.string().nullable(),
  moderationReason: z.string().nullable(),
  duplicateOf: z.string().nullable(),
  liveForMinutes: z.number(),
  media: z.array(
    z.object({
      publicKey: z.string(),
      originalKey: z.string(),
      note: z.object({ original: z.string(), public: z.string() }),
    }),
  ),
  reporter: z
    .object({
      label: z.string(),
      accountAgeDays: z.number(),
      history: z.object({ published: z.number(), rejected: z.number(), flagsOnReports: z.number() }),
    })
    .nullable(),
  flagsDetail: z.array(
    z.object({ number: z.number(), reason: z.string(), details: z.string().nullish(), at: z.string() }),
  ),
  possibleDuplicates: z.array(
    z.object({ ref: z.string(), title: z.string(), distanceM: z.number(), createdAt: z.string() }),
  ),
});
export type ReportReview = z.infer<typeof ReportReviewSchema>;

export const UpdateRowSchema = z.object({
  id: z.string(),
  ref: z.string(),
  type: z.string(),
  reportRef: z.string(),
  note: z.string().nullish(),
  photos: z.number(),
  state: z.enum(["live", "hidden"]),
  flags: z.number(),
  createdAt: z.string(),
});
export type UpdateRow = z.infer<typeof UpdateRowSchema>;

export const FlagRowSchema = z.object({
  id: z.string(),
  number: z.number(),
  targetType: z.enum(["report", "update", "user"]),
  targetRef: z.string(),
  reason: z.string(),
  details: z.string().nullish(),
  status: z.enum(["open", "resolved"]),
  outcome: z.string().nullish(),
  flagsOnTarget: z.number(),
  ageMinutes: z.number(),
  createdAt: z.string(),
});
export type FlagRow = z.infer<typeof FlagRowSchema>;

export const UserStatusSchema = z.enum(["active", "restricted", "suspended", "banned", "deleted"]);
export const UserRowSchema = z.object({
  id: z.string(),
  handle: z.number(),
  label: z.string(),
  status: UserStatusSchema,
  warnings: z.number(),
  reports: z.number(),
  updates: z.number(),
  flagsAgainst: z.number(),
  blocksAgainst: z.number().nullable(),
  createdAt: z.string(),
});
export type UserRow = z.infer<typeof UserRowSchema>;

export const PeriodRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
  status: z.enum(["draft", "published"]),
  allocations: z.number(),
});
export type PeriodRow = z.infer<typeof PeriodRowSchema>;

export const AllocationSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  beneficiary: z.string(),
  category: z.enum(["shelter", "rescue_group", "vet_clinic", "other"]),
  amount: z.number(),
  currency: z.string(),
  transferDate: z.string(),
  publicNote: z.string(),
  evidence: z.array(z.string()),
  redactionChecked: z.boolean(),
  transferConfirmed: z.boolean(),
  status: z.enum(["draft", "verified", "published"]),
  publishedAt: z.string().nullable(),
});
export type Allocation = z.infer<typeof AllocationSchema>;

export const RegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
  languages: z.array(z.enum(["en", "id"])),
  defaultExpiryDays: z.number(),
  supportContact: z.string().nullable(),
  center: z.object({ lat: z.number(), lng: z.number() }),
  radiusKm: z.number(),
});
export type Region = z.infer<typeof RegionSchema>;

export const AppConfigSchema = z.object({
  featureFlags: z.object({
    communityUpdates: z.boolean(),
    nearbyAlerts: z.boolean(),
    listAds: z.boolean(),
    impactBannerAd: z.boolean(),
    restrictToRegions: z.boolean(),
  }),
  safetyLimits: z.object({
    autoHideAfterFlags: z.number(),
    reportsPerUserPerHour: z.number(),
    updatesPerUserPerHour: z.number(),
    reportExpiryDays: z.number(),
    minimumAppVersion: z.string(),
  }),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const PlacementSchema = z.object({
  id: z.string(),
  label: z.string(),
  screen: z.string(),
  frequencyCap: z.string(),
  locked: z.boolean(),
  global: z.boolean(),
  regions: z.array(z.object({ regionId: z.string(), regionName: z.string(), enabled: z.boolean() })),
});
export type Placement = z.infer<typeof PlacementSchema>;

export const SupportRowSchema = z.object({
  id: z.string(),
  ref: z.string(),
  from: z.string(),
  topic: z.string(),
  language: z.string(),
  status: z.enum(["new", "assigned", "resolved"]),
  assignee: z.string().nullable(),
  escalated: z.boolean(),
  reportRef: z.string().nullable(),
  ageMinutes: z.number(),
});
export const SupportDetailSchema = SupportRowSchema.extend({
  message: z.string(),
  replies: z.array(z.object({ body: z.string(), at: z.string(), delivered: z.boolean() })),
  notes: z.array(z.object({ body: z.string(), at: z.string() })),
});
export type SupportRow = z.infer<typeof SupportRowSchema>;
export type SupportDetail = z.infer<typeof SupportDetailSchema>;

export const PrivacyStatusSchema = z.enum(["received", "verifying", "completed", "rejected"]);
export const PrivacyRowSchema = z.object({
  id: z.string(),
  ref: z.string(),
  type: z.string(),
  from: z.string(),
  status: PrivacyStatusSchema,
  createdAt: z.string(),
  dueAt: z.string(),
  dueInDays: z.number(),
});
export const PrivacyDetailSchema = PrivacyRowSchema.extend({
  accountIdentifier: z.string().nullable(),
  details: z.string(),
  checklist: z.object({ emailMatchesAccount: z.boolean(), extraProofReceived: z.boolean() }),
  notes: z.array(z.object({ body: z.string(), at: z.string() })),
});
export type PrivacyRow = z.infer<typeof PrivacyRowSchema>;
export type PrivacyDetail = z.infer<typeof PrivacyDetailSchema>;
