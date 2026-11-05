import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Clock } from "@/backend/shared/application/clock";
import { NotFoundError } from "@/backend/shared/domain/errors";
import { actorOf, type Principal } from "@/backend/shared/domain/principal";
import {
  assertAmount,
  edited,
  publish,
  totalsByCurrency,
  unpublish,
  verify,
  type Allocation,
  type BeneficiaryCategory,
  type ImpactPeriod,
} from "../domain/impact";
import type { ImpactRepository } from "../domain/repositories";

const allocationDto = (a: Allocation) => ({
  id: a.id,
  periodId: a.periodId,
  beneficiary: a.beneficiary,
  category: a.category,
  amount: a.amount,
  currency: a.currency,
  transferDate: a.transferDate.toISOString(),
  publicNote: a.publicNote,
});

export class ImpactPublic {
  constructor(private readonly repo: ImpactRepository) {}

  /** Allocations visible to the public: published, in a published period. */
  private async visible(periodId?: string): Promise<Allocation[]> {
    const published = new Set((await this.repo.listPeriods()).filter((p) => p.published).map((p) => p.id));
    return (await this.repo.listAllocations(periodId)).filter((a) => a.status === "published" && published.has(a.periodId));
  }

  async overview() {
    const [periods, allocations] = await Promise.all([this.repo.listPeriods(), this.visible()]);
    const recent = [...allocations].sort((a, b) => b.transferDate.getTime() - a.transferDate.getTime());
    return {
      disclaimer: "Company allocations — not user donations.",
      totals: totalsByCurrency(allocations),
      beneficiaries: new Set(allocations.map((a) => a.beneficiary)).size,
      periods: periods.filter((p) => p.published).map((p) => ({ id: p.id, label: p.label })),
      recent: recent.slice(0, 10).map(allocationDto),
    };
  }

  async period(id: string) {
    const period = await this.repo.findPeriod(id);
    if (!period?.published) throw new NotFoundError("Period not found");
    const allocations = await this.visible(id);
    return {
      id: period.id,
      label: period.label,
      summary: period.summary,
      totals: totalsByCurrency(allocations),
      allocations: allocations.sort((a, b) => b.transferDate.getTime() - a.transferDate.getTime()).map(allocationDto),
    };
  }

  async allocation(id: string) {
    const a = (await this.visible()).find((x) => x.id === id);
    if (!a) throw new NotFoundError("Allocation not found");
    const period = await this.repo.findPeriod(a.periodId);
    return { ...allocationDto(a), verified: true, periodLabel: period?.label ?? null, evidence: a.evidence };
  }
}

export interface AllocationCommand {
  beneficiary: string;
  category: BeneficiaryCategory;
  amount: number;
  currency: string;
  transferDate: Date;
  publicNote: string;
  evidence: string[];
  redactionChecked: boolean;
}

export class ImpactAdmin {
  constructor(
    private readonly repo: ImpactRepository,
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
  ) {}

  private adminDto = (a: Allocation) => ({
    ...allocationDto(a),
    evidence: a.evidence,
    redactionChecked: a.redactionChecked,
    transferConfirmed: a.transferConfirmed,
    status: a.status,
    publishedAt: a.publishedAt?.toISOString() ?? null,
  });

  async listPeriods() {
    const [periods, allocations] = await Promise.all([this.repo.listPeriods(), this.repo.listAllocations()]);
    return periods
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((p) => ({
        id: p.id,
        label: p.label,
        summary: p.summary,
        status: p.published ? ("published" as const) : ("draft" as const),
        allocations: allocations.filter((a) => a.periodId === p.id).length,
      }));
  }

  async createPeriod(admin: Principal, input: { label: string; summary: string }) {
    const period: ImpactPeriod = { id: crypto.randomUUID(), ...input, published: false, createdAt: this.clock.now() };
    await this.repo.savePeriod(period);
    await this.audit.record({ actor: actorOf(admin), action: "impact.period_create", target: period.label });
    return period;
  }

  private async period(id: string) {
    const p = await this.repo.findPeriod(id);
    if (!p) throw new NotFoundError("Period not found");
    return p;
  }

  async updatePeriod(admin: Principal, id: string, patch: { label?: string; summary?: string; published?: boolean }) {
    const next = { ...(await this.period(id)), ...patch };
    await this.repo.savePeriod(next);
    const action = patch.published === undefined ? "impact.period_update" : patch.published ? "impact.publish_period" : "impact.unpublish_period";
    await this.audit.record({ actor: actorOf(admin), action, target: next.label });
    return next;
  }

  async listAllocations(periodId: string) {
    await this.period(periodId);
    return (await this.repo.listAllocations(periodId)).map(this.adminDto);
  }

  async createAllocation(admin: Principal, periodId: string, cmd: AllocationCommand) {
    await this.period(periodId);
    assertAmount(cmd.amount);
    const a: Allocation = {
      id: crypto.randomUUID(),
      periodId,
      ...cmd,
      transferConfirmed: false,
      status: "draft",
      publishedAt: null,
    };
    await this.repo.saveAllocation(a);
    await this.audit.record({ actor: actorOf(admin), action: "impact.allocation_create", target: a.id, metadata: { currency: a.currency } });
    return this.adminDto(a);
  }

  async updateAllocation(admin: Principal, id: string, patch: Partial<AllocationCommand> & { transferConfirmed?: boolean }) {
    const current = await this.repo.findAllocation(id);
    if (!current) throw new NotFoundError("Allocation not found");
    const next = edited(current, patch);
    await this.repo.saveAllocation(next);
    await this.audit.record({ actor: actorOf(admin), action: "impact.allocation_update", target: id });
    return this.adminDto(next);
  }

  async stage(admin: Principal, id: string, to: "draft" | "verified" | "published") {
    const current = await this.repo.findAllocation(id);
    if (!current) throw new NotFoundError("Allocation not found");
    const period = await this.period(current.periodId);
    const next = to === "verified" ? verify(current) : to === "published" ? publish(current, period, this.clock.now()) : unpublish(current);
    await this.repo.saveAllocation(next);
    await this.audit.record({
      actor: actorOf(admin),
      action: to === "published" ? "impact.publish" : to === "verified" ? "impact.verify" : "impact.unpublish",
      target: period.label,
      metadata: { allocation: id },
    });
    return this.adminDto(next);
  }
}
