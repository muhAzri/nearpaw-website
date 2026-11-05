import type { Actor } from "@/backend/shared/domain/principal";
import type { Page } from "@/backend/shared/domain/page";

export interface AuditRecord {
  readonly id: string;
  readonly at: Date;
  readonly actor: Actor;
  readonly action: string;
  readonly target: string;
  readonly reason: string | null;
  readonly metadata: Record<string, string | number | boolean>;
}

export interface AuditCriteria {
  actor?: Actor["kind"];
  action?: string;
  target?: string;
  from?: Date;
  to?: Date;
  limit: number;
  offset: number;
}

/** Append-only: there is deliberately no update or delete. */
export interface AuditRepository {
  append(record: AuditRecord): Promise<void>;
  search(criteria: AuditCriteria): Promise<Page<AuditRecord>>;
  recent(limit: number): Promise<AuditRecord[]>;
}
