export const FLAG_REASONS = ["inaccurate", "duplicate", "abusive", "graphic", "spam", "private_info", "other"] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];
export type FlagTarget = "report" | "update" | "user";
export type FlagOutcome = "none" | "hide" | "warn" | "restrict";

export interface Flag {
  readonly id: string;
  /** Human-friendly sequence shown in the console as #212. */
  readonly number: number;
  readonly targetType: FlagTarget;
  /** Internal id of the report / update / user. */
  readonly targetId: string;
  /** Public reference used for display (RPT-…, UPD-…, Community #…). */
  readonly targetRef: string;
  readonly flaggerId: string;
  readonly reason: FlagReason;
  readonly details: string | null;
  readonly status: "open" | "resolved";
  readonly outcome: FlagOutcome | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

/** Enough distinct people flagging hides the content automatically. */
export const shouldAutoHide = (distinctOpenFlags: number, threshold: number) => distinctOpenFlags >= threshold;
