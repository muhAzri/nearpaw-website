import { z } from "zod";

export const AnimalSchema = z.enum(["cat", "dog", "wildlife", "other"]);
export const ConditionSchema = z.enum(["injured", "sick", "abandoned", "trapped", "suspected_abuse", "other"]);
export const UrgencySchema = z.enum(["low", "medium", "high"]);
export const ReportStateSchema = z.enum(["live", "hidden", "closed", "expired", "removed"]);
export const UpdateTypeSchema = z.enum(["still_there", "not_found", "condition_changed", "possibly_helped"]);
export const FlagReasonSchema = z.enum([
  "inaccurate",
  "duplicate",
  "abusive",
  "graphic",
  "spam",
  "private_info",
  "other",
]);
export const FlagTargetSchema = z.enum(["report", "update", "user"]);
export const LanguageSchema = z.enum(["en", "id"]);
