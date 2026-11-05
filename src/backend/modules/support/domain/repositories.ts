import type { Page } from "@/backend/shared/domain/page";
import type { PrivacyRequest, PrivacyStatus, SupportMessage, SupportStatus, SupportTopic } from "./support";

export interface SupportRepository {
  addMessage(m: SupportMessage): Promise<void>;
  saveMessage(m: SupportMessage): Promise<void>;
  findMessage(id: string): Promise<SupportMessage | null>;
  searchMessages(c: { status?: SupportStatus; topic?: SupportTopic; language?: string; limit: number; offset: number }): Promise<Page<SupportMessage>>;
  countMessages(status: SupportStatus): Promise<number>;

  addPrivacy(r: PrivacyRequest): Promise<void>;
  savePrivacy(r: PrivacyRequest): Promise<void>;
  findPrivacy(id: string): Promise<PrivacyRequest | null>;
  searchPrivacy(c: { status?: PrivacyStatus; limit: number; offset: number }): Promise<Page<PrivacyRequest>>;
  openPrivacy(): Promise<PrivacyRequest[]>;
}
