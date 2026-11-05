import { ForbiddenError, ValidationError } from "@/backend/shared/domain/errors";
import { generateReference } from "@/backend/shared/domain/reference";
import { publicText } from "@/backend/shared/domain/text";
import { effectiveState, type HiddenBy, type Report } from "./report";

export const UPDATE_TYPES = ["still_there", "not_found", "condition_changed", "possibly_helped"] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

/** Posted immediately, labelled "Community update", never changes the report's status. */
export interface CommunityUpdate {
  readonly id: string;
  readonly ref: string;
  readonly reportId: string;
  readonly reportRef: string;
  readonly authorId: string;
  readonly type: UpdateType;
  readonly note: string | null;
  readonly photos: readonly string[];
  readonly state: "live" | "hidden";
  readonly hiddenBy: HiddenBy | null;
  readonly openFlags: number;
  readonly createdAt: Date;
}

export function createUpdate(
  report: Report,
  input: { authorId: string; type: UpdateType; note?: string; photos: string[]; now: Date },
): CommunityUpdate {
  if (effectiveState(report, input.now) !== "live") throw new ForbiddenError("Updates can only be added to live reports");
  if (input.photos.length > 1) throw new ValidationError("At most 1 photo per update");
  const note = input.note?.trim() ? publicText(input.note, "Note", { max: 140 }) : null;
  return {
    id: crypto.randomUUID(),
    ref: generateReference("UPD", 4),
    reportId: report.id,
    reportRef: report.ref,
    authorId: input.authorId,
    type: input.type,
    note,
    photos: input.photos,
    state: "live",
    hiddenBy: null,
    openFlags: 0,
    createdAt: input.now,
  };
}

export const hideUpdate = (u: CommunityUpdate, by: HiddenBy): CommunityUpdate => ({ ...u, state: "hidden", hiddenBy: by });
export const restoreUpdate = (u: CommunityUpdate): CommunityUpdate => ({ ...u, state: "live", hiddenBy: null });
