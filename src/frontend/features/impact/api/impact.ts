import { z } from "zod";
import { ApiError, apiData } from "@/frontend/shared/lib/api-client";

const TotalsSchema = z.array(z.object({ currency: z.string(), amount: z.number() }));

const AllocationSchema = z.object({
  id: z.string(),
  periodId: z.string(),
  beneficiary: z.string(),
  category: z.string(),
  amount: z.number(),
  currency: z.string(),
  transferDate: z.string(),
  publicNote: z.string(),
});

const OverviewSchema = z.object({
  disclaimer: z.string(),
  totals: TotalsSchema,
  beneficiaries: z.number(),
  periods: z.array(z.object({ id: z.string(), label: z.string() })),
  recent: z.array(AllocationSchema),
});

const PeriodSchema = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
  totals: TotalsSchema,
  allocations: z.array(AllocationSchema),
});

const AllocationDetailSchema = AllocationSchema.extend({
  verified: z.boolean(),
  periodLabel: z.string().nullable(),
  evidence: z.array(z.string()),
});

export type ImpactOverview = z.infer<typeof OverviewSchema>;
export type ImpactPeriod = z.infer<typeof PeriodSchema>;
export type PublicAllocation = z.infer<typeof AllocationSchema>;
export type AllocationDetail = z.infer<typeof AllocationDetailSchema>;

async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const getImpactOverview = () => apiData("/impact", OverviewSchema);

export const getImpactPeriod = (id: string) =>
  orNull(apiData(`/impact/periods/${encodeURIComponent(id)}`, PeriodSchema));

export const getAllocation = (id: string) =>
  orNull(apiData(`/impact/allocations/${encodeURIComponent(id)}`, AllocationDetailSchema));
