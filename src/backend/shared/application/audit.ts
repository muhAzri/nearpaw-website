import type { Actor } from "../domain/principal";

export interface AuditEntryInput {
  readonly actor: Actor;
  /** e.g. report.hide, flag.resolve, impact.publish */
  readonly action: string;
  /** Reference or opaque id. Never personal data. */
  readonly target: string;
  readonly reason?: string;
  readonly metadata?: Record<string, string | number | boolean>;
}

/** Port implemented by the audit module; every admin/system mutation goes through it. */
export interface AuditRecorder {
  record(entry: AuditEntryInput): Promise<void>;
}
