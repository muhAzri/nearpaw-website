import { z } from "zod";
import { UrgencySchema } from "@/contracts";
import { ApiError, apiData } from "@/frontend/shared/lib/api-client";

const SharedReportSchema = z.object({
  ref: z.string(),
  title: z.string(),
  urgency: UrgencySchema,
  state: z.literal("live"),
  area: z.string().nullable(),
  createdAt: z.string(),
});

export type SharedReport = z.infer<typeof SharedReportSchema>;

/** The coarse, public view of a live report. `null` = gone (expired, hidden, removed or never existed). */
export async function getSharedReport(ref: string): Promise<SharedReport | null> {
  try {
    return await apiData(`/public/reports/${encodeURIComponent(ref)}`, SharedReportSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
