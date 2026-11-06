import type { SupabaseClient } from "@supabase/supabase-js";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { Allocation, ImpactPeriod } from "../domain/impact";
import type { ImpactRepository } from "../domain/repositories";

export interface PeriodRow {
  id: string;
  label: string;
  summary: string;
  published: boolean;
  created_at: string;
}

export interface AllocationRow {
  id: string;
  period_id: string;
  beneficiary: string;
  category: Allocation["category"];
  amount: number | string;
  currency: string;
  transfer_date: string;
  public_note: string;
  evidence: string[];
  redaction_checked: boolean;
  transfer_confirmed: boolean;
  status: Allocation["status"];
  published_at: string | null;
}

export const periodFromRow = (r: PeriodRow): ImpactPeriod => ({ id: r.id, label: r.label, summary: r.summary, published: r.published, createdAt: new Date(r.created_at) });
export const periodToRow = (p: ImpactPeriod): PeriodRow => ({ id: p.id, label: p.label, summary: p.summary, published: p.published, created_at: p.createdAt.toISOString() });

export const allocationFromRow = (r: AllocationRow): Allocation => ({
  id: r.id,
  periodId: r.period_id,
  beneficiary: r.beneficiary,
  category: r.category,
  amount: Number(r.amount),
  currency: r.currency,
  transferDate: new Date(r.transfer_date),
  publicNote: r.public_note,
  evidence: r.evidence,
  redactionChecked: r.redaction_checked,
  transferConfirmed: r.transfer_confirmed,
  status: r.status,
  publishedAt: r.published_at ? new Date(r.published_at) : null,
});

export const allocationToRow = (a: Allocation): AllocationRow => ({
  id: a.id,
  period_id: a.periodId,
  beneficiary: a.beneficiary,
  category: a.category,
  amount: a.amount,
  currency: a.currency,
  transfer_date: a.transferDate.toISOString().slice(0, 10), // a `date` column
  public_note: a.publicNote,
  evidence: [...a.evidence],
  redaction_checked: a.redactionChecked,
  transfer_confirmed: a.transferConfirmed,
  status: a.status,
  published_at: a.publishedAt?.toISOString() ?? null,
});

/** `impact_periods` and `allocations` through the secret key. */
export class SupabaseImpactRepository implements ImpactRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listPeriods() {
    const rows = unwrap(await this.db.from("impact_periods").select("*").order("created_at"), "impact.listPeriods");
    return (rows as PeriodRow[]).map(periodFromRow);
  }
  async findPeriod(id: string) {
    const row = unwrap(await this.db.from("impact_periods").select("*").eq("id", id).maybeSingle<PeriodRow>(), "impact.findPeriod");
    return row ? periodFromRow(row) : null;
  }
  async savePeriod(p: ImpactPeriod) {
    check(await this.db.from("impact_periods").upsert(periodToRow(p), { onConflict: "id" }), "impact.savePeriod");
  }
  async listAllocations(periodId?: string) {
    let query = this.db.from("allocations").select("*");
    if (periodId) query = query.eq("period_id", periodId);
    const rows = unwrap(await query.order("transfer_date", { ascending: false }), "impact.listAllocations");
    return (rows as AllocationRow[]).map(allocationFromRow);
  }
  async findAllocation(id: string) {
    const row = unwrap(await this.db.from("allocations").select("*").eq("id", id).maybeSingle<AllocationRow>(), "impact.findAllocation");
    return row ? allocationFromRow(row) : null;
  }
  async saveAllocation(a: Allocation) {
    check(await this.db.from("allocations").upsert(allocationToRow(a), { onConflict: "id" }), "impact.saveAllocation");
  }
}
