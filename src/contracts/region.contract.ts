import { z } from "zod";
import { LanguageSchema } from "./enums";

const LatSchema = z.number().min(-90).max(90);
const LngSchema = z.number().min(-180).max(180);

export const RegionInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  languages: z.array(LanguageSchema).max(2),
  defaultExpiryDays: z.number().int().min(1).max(60),
  supportContact: z.string().trim().min(2).max(120).nullable(),
  center: z.object({ lat: LatSchema, lng: LngSchema }),
  radiusKm: z.number().min(1).max(200),
});
export type RegionInput = z.infer<typeof RegionInputSchema>;

export const RegionPatchSchema = RegionInputSchema.partial().extend({
  status: z.enum(["active", "inactive"]).optional(),
});

export const AppConfigPatchSchema = z.object({
  featureFlags: z
    .object({
      communityUpdates: z.boolean(),
      nearbyAlerts: z.boolean(),
      listAds: z.boolean(),
      impactBannerAd: z.boolean(),
      restrictToRegions: z.boolean(),
    })
    .partial()
    .optional(),
  safetyLimits: z
    .object({
      autoHideAfterFlags: z.number().int().min(1).max(50),
      reportsPerUserPerHour: z.number().int().min(1).max(100),
      updatesPerUserPerHour: z.number().int().min(1).max(100),
      reportExpiryDays: z.number().int().min(1).max(60),
      minimumAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
    })
    .partial()
    .optional(),
});

export const AdPlacementPatchSchema = z.object({
  /** Omit to switch the placement for everywhere. */
  regionId: z.uuid().optional(),
  enabled: z.boolean(),
});
