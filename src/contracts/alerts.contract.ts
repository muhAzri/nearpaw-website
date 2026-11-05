import { z } from "zod";
import { AnimalSchema } from "./enums";

export const AlertSettingsSchema = z.object({
  enabled: z.boolean(),
  area: z
    .object({
      label: z.string().trim().min(2).max(120),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .nullable(),
  radiusKm: z.union([z.literal(2), z.literal(5), z.literal(10), z.literal(25)]),
  animals: z.array(AnimalSchema).max(4),
});
export type AlertSettingsInput = z.infer<typeof AlertSettingsSchema>;

export const RegisterDeviceSchema = z.object({
  token: z.string().min(10).max(400),
  platform: z.literal("ios").default("ios"),
});

export const AlertFeedQuerySchema = z.object({
  unread: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export const MarkReadSchema = z.object({ ids: z.array(z.uuid()).max(200).optional() });
