import type { Allocation, ImpactPeriod } from "../../modules/impact/domain/impact";
import type { ImpactRepository } from "../../modules/impact/domain/repositories";

export class InMemoryImpactRepository implements ImpactRepository {
  private readonly periods = new Map<string, ImpactPeriod>();
  private readonly allocations = new Map<string, Allocation>();

  async listPeriods() {
    return [...this.periods.values()];
  }
  async findPeriod(id: string) {
    return this.periods.get(id) ?? null;
  }
  async savePeriod(p: ImpactPeriod) {
    this.periods.set(p.id, p);
  }
  async listAllocations(periodId?: string) {
    return [...this.allocations.values()].filter((a) => !periodId || a.periodId === periodId);
  }
  async findAllocation(id: string) {
    return this.allocations.get(id) ?? null;
  }
  async saveAllocation(a: Allocation) {
    this.allocations.set(a.id, a);
  }
}
