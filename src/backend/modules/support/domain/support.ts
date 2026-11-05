import { ValidationError } from "@/backend/shared/domain/errors";

export type SupportTopic = "content_abuse" | "bug" | "privacy" | "press" | "other";
export type SupportStatus = "new" | "assigned" | "resolved";
export type PrivacyType = "access" | "deletion" | "correction" | "other";
export type PrivacyStatus = "received" | "verifying" | "completed" | "rejected";

export interface SupportMessage {
  readonly id: string;
  readonly ref: string;
  readonly topic: SupportTopic;
  readonly email: string;
  readonly language: "en" | "id";
  readonly message: string;
  readonly reportRef: string | null;
  readonly status: SupportStatus;
  readonly assignee: string | null;
  readonly escalated: boolean;
  readonly replies: readonly { body: string; at: Date; delivered: boolean }[];
  /** Internal only: never sent to the sender. */
  readonly notes: readonly { body: string; at: Date }[];
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

export interface PrivacyRequest {
  readonly id: string;
  readonly ref: string;
  readonly type: PrivacyType;
  readonly email: string;
  readonly accountIdentifier: string | null;
  readonly details: string;
  readonly status: PrivacyStatus;
  readonly emailMatchesAccount: boolean;
  readonly extraProofReceived: boolean;
  readonly notes: readonly { body: string; at: Date }[];
  readonly createdAt: Date;
  readonly dueAt: Date;
  readonly completedAt: Date | null;
}

export const PRIVACY_RESPONSE_DAYS = 30;

/** a***@gmail.com — enough to recognise, not enough to contact. */
export function maskEmail(email: string): string {
  const [local, domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export function assertCanComplete(request: PrivacyRequest): void {
  if (!request.emailMatchesAccount) {
    throw new ValidationError("Verify that the email matches the account before completing the request");
  }
}
