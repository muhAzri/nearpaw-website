import { ApiError } from "./api-client";

export interface FormError {
  /** Message for the whole form. */
  message: string;
  /** Messages keyed by field name, when the backend or a schema pinpointed them. */
  fields: Record<string, string>;
}

/** Turns zod's flattened field errors (`{ fieldErrors: { name: [msg] } }`) into one message per field. */
export function fieldErrorsFrom(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (details && typeof details === "object" && "fieldErrors" in details) {
    const fieldErrors = (details as { fieldErrors: Record<string, string[] | undefined> }).fieldErrors;
    for (const [name, messages] of Object.entries(fieldErrors)) {
      if (messages?.[0]) out[name] = messages[0];
    }
  }
  return out;
}

/** Blameless, user-facing wording for anything a request can throw. */
export function describeError(error: unknown): FormError {
  if (error instanceof ApiError) {
    if (error.status === 429) return { message: error.message || "Too many requests. Please try again later.", fields: {} };
    if (error.status === 422) {
      const fields = fieldErrorsFrom(error.details);
      return { message: Object.keys(fields).length ? "Please check the highlighted fields." : error.message, fields };
    }
    if (error.status >= 500) return { message: "Something went wrong on our side. Please try again in a moment.", fields: {} };
    return { message: error.message, fields: {} };
  }
  return { message: "We couldn’t reach Nearpaw. Check your connection and try again.", fields: {} };
}
