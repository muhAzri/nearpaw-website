import { z } from "zod";
import type { CreatePrivacyRequestSchema, CreateSupportMessageSchema } from "@/contracts";
import { apiData } from "@/frontend/shared/lib/api-client";

const SupportReceiptSchema = z.object({ ref: z.string(), firstReplyWithinBusinessDays: z.number() });
const PrivacyReceiptSchema = z.object({ ref: z.string(), dueAt: z.string() });

export const sendSupportMessage = (input: z.input<typeof CreateSupportMessageSchema>) =>
  apiData("/support", SupportReceiptSchema, { method: "POST", body: input });

export const sendPrivacyRequest = (input: z.input<typeof CreatePrivacyRequestSchema>) =>
  apiData("/privacy-requests", PrivacyReceiptSchema, { method: "POST", body: input });
