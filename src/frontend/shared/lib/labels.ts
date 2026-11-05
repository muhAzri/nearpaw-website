import { humanize } from "./format";

/** Human wording for backend enum values. Unknown values fall back to a humanized form. */
const maps = {
  animal: { cat: "Cat", dog: "Dog", wildlife: "Wildlife", other: "Other" },
  category: { shelter: "Shelter", rescue_group: "Rescue group", vet_clinic: "Vet clinic", other: "Other" },
  updateType: {
    still_there: "Still there",
    not_found: "Not found",
    condition_changed: "Condition changed",
    possibly_helped: "Possibly helped",
  },
  flagReason: {
    inaccurate: "Inaccurate",
    duplicate: "Duplicate",
    abusive: "Abusive",
    graphic: "Graphic content",
    spam: "Spam",
    private_info: "Shows private info",
    other: "Other",
  },
  supportTopic: { content_abuse: "Content or abuse", bug: "Bug", privacy: "Privacy", press: "Press", other: "Other" },
  privacyType: { access: "Access / export", deletion: "Deletion", correction: "Correction", other: "Other" },
} as const satisfies Record<string, Record<string, string>>;

export type LabelKind = keyof typeof maps;

export function labelOf(kind: LabelKind, value: string): string {
  const map: Record<string, string> = maps[kind];
  return map[value] ?? humanize(value);
}

export const optionsOf = (kind: LabelKind) =>
  Object.entries(maps[kind]).map(([value, label]) => ({ value, label }));
