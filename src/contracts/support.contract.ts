import { z } from "zod";
import { LanguageSchema } from "./enums";

export const SupportTopicSchema = z.enum(["content_abuse", "bug", "privacy", "press", "other"]);

export const CreateSupportMessageSchema = z.object({
  topic: SupportTopicSchema,
  email: z.email().max(254),
  language: LanguageSchema.default("en"),
  message: z.string().trim().min(10).max(2000),
  reportRef: z.string().regex(/^RPT-[A-Z0-9]{6}$/).optional(),
  /** Honeypot: real users never fill this. */
  website: z.string().max(0).optional(),
});

export const CreatePrivacyRequestSchema = z.object({
  type: z.enum(["access", "deletion", "correction", "other"]),
  email: z.email().max(254),
  accountIdentifier: z.string().trim().max(120).optional(),
  details: z.string().trim().min(5).max(2000),
  website: z.string().max(0).optional(),
});

export const AdminInboxQuerySchema = z.object({
  status: z.enum(["new", "assigned", "resolved"]).optional(),
  topic: SupportTopicSchema.optional(),
  language: LanguageSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const SupportActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reply"), body: z.string().trim().min(2).max(4000) }),
  z.object({ action: z.literal("assign"), assignee: z.string().trim().min(1).max(60) }),
  z.object({ action: z.literal("escalate"), note: z.string().trim().min(3).max(1000) }),
  z.object({ action: z.literal("resolve") }),
  z.object({ action: z.literal("note"), note: z.string().trim().min(1).max(1000) }),
]);

export const AdminPrivacyQuerySchema = z.object({
  status: z.enum(["received", "verifying", "completed", "rejected"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const PrivacyRequestPatchSchema = z.object({
  status: z.enum(["verifying", "completed", "rejected"]).optional(),
  emailMatchesAccount: z.boolean().optional(),
  extraProofReceived: z.boolean().optional(),
  note: z.string().trim().max(1000).optional(),
});
