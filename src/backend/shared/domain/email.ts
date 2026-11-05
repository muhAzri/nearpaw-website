import { ValidationError } from "./errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Value object: always normalized and valid once constructed. */
export class Email {
  private constructor(readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (normalized.length > 254 || !EMAIL_RE.test(normalized)) {
      throw new ValidationError("Invalid email address", { email: raw });
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
