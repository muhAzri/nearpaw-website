import type { Allocation, ImpactPeriod } from "./impact";

export interface ImpactRepository {
  listPeriods(): Promise<ImpactPeriod[]>;
  findPeriod(id: string): Promise<ImpactPeriod | null>;
  savePeriod(period: ImpactPeriod): Promise<void>;
  listAllocations(periodId?: string): Promise<Allocation[]>;
  findAllocation(id: string): Promise<Allocation | null>;
  saveAllocation(allocation: Allocation): Promise<void>;
}
