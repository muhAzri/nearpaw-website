import { ValidationError } from "./errors";

// 8+ digits with common separators: phone numbers, not "2 km" or "12 m".
const PHONE_RE = /(?:\+?\d[\s().-]?){8,}/;
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function containsContactInfo(text: string): boolean {
  return PHONE_RE.test(text) || EMAIL_RE.test(text);
}

/** Public free text: trimmed, bounded, and free of phone numbers / emails. */
export function publicText(raw: string, field: string, opts: { min?: number; max: number }): string {
  const value = raw.trim();
  if (value.length < (opts.min ?? 0) || value.length > opts.max) {
    throw new ValidationError(`${field} must be ${opts.min ?? 0}-${opts.max} characters`, { field });
  }
  if (containsContactInfo(value)) {
    throw new ValidationError(`${field} must not include phone numbers or email addresses`, { field });
  }
  return value;
}
