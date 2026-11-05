import { ForbiddenError, ValidationError } from "@/backend/shared/domain/errors";

export type AllocationStatus = "draft" | "verified" | "published";
export type BeneficiaryCategory = "shelter" | "rescue_group" | "vet_clinic" | "other";

export interface ImpactPeriod {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly published: boolean;
  readonly createdAt: Date;
}

/** Company allocations, not user donations. Currencies are never added together. */
export interface Allocation {
  readonly id: string;
  readonly periodId: string;
  readonly beneficiary: string;
  readonly category: BeneficiaryCategory;
  /** Major units with at most 2 decimals. */
  readonly amount: number;
  readonly currency: string;
  readonly transferDate: Date;
  readonly publicNote: string;
  /** Redacted evidence only (storage keys). */
  readonly evidence: readonly string[];
  readonly redactionChecked: boolean;
  readonly transferConfirmed: boolean;
  readonly status: AllocationStatus;
  readonly publishedAt: Date | null;
}

export const toMinor = (amount: number) => Math.round(amount * 100);

export function assertAmount(amount: number): void {
  if (!(amount > 0) || Math.abs(toMinor(amount) / 100 - amount) > 1e-9) {
    throw new ValidationError("Amount must be positive with at most 2 decimals");
  }
}

/** Editing a verified record sends it back to draft; published records must be unpublished first. */
export function edited(a: Allocation, patch: Partial<Allocation>): Allocation {
  if (a.status === "published") throw new ForbiddenError("Unpublish this allocation before editing it");
  if (patch.amount !== undefined) assertAmount(patch.amount);
  return { ...a, ...patch, id: a.id, periodId: a.periodId, status: "draft", publishedAt: null };
}

export function verify(a: Allocation): Allocation {
  if (a.status === "published") throw new ForbiddenError("Already published");
  if (!a.transferConfirmed) throw new ValidationError("Confirm the transfer before verifying");
  if (a.evidence.length === 0) throw new ValidationError("Upload redacted evidence before verifying");
  return { ...a, status: "verified" };
}

export function publish(a: Allocation, period: ImpactPeriod, now: Date): Allocation {
  if (a.status !== "verified") throw new ValidationError("Publishing needs a verified, transfer-confirmed record");
  if (!a.redactionChecked) throw new ValidationError("Confirm the evidence has been checked for private details");
  void period;
  return { ...a, status: "published", publishedAt: now };
}

export const unpublish = (a: Allocation): Allocation => ({ ...a, status: "draft", publishedAt: null });

export function totalsByCurrency(allocations: readonly Allocation[]): { currency: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const a of allocations) totals.set(a.currency, (totals.get(a.currency) ?? 0) + toMinor(a.amount));
  return [...totals].map(([currency, minor]) => ({ currency, amount: minor / 100 })).sort((x, y) => x.currency.localeCompare(y.currency));
}
