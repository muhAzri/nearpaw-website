import type { Page } from "@/backend/shared/domain/page";
import type { SupportRepository } from "../domain/repositories";
import type { PrivacyRequest, PrivacyStatus, SupportMessage, SupportStatus, SupportTopic } from "../domain/support";
import type { Mailer } from "../application/support.usecases";

const page = <T>(items: T[], offset: number, limit: number): Page<T> => ({ items: items.slice(offset, offset + limit), total: items.length });

export class InMemorySupportRepository implements SupportRepository {
  private readonly messages = new Map<string, SupportMessage>();
  private readonly privacy = new Map<string, PrivacyRequest>();

  async addMessage(m: SupportMessage) {
    this.messages.set(m.id, m);
  }
  async saveMessage(m: SupportMessage) {
    this.messages.set(m.id, m);
  }
  async findMessage(id: string) {
    return this.messages.get(id) ?? null;
  }
  async searchMessages(c: { status?: SupportStatus; topic?: SupportTopic; language?: string; limit: number; offset: number }) {
    const hits = [...this.messages.values()]
      .filter((m) => (!c.status || m.status === c.status) && (!c.topic || m.topic === c.topic) && (!c.language || m.language === c.language))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return page(hits, c.offset, c.limit);
  }
  async countMessages(status: SupportStatus) {
    return [...this.messages.values()].filter((m) => m.status === status).length;
  }

  async addPrivacy(r: PrivacyRequest) {
    this.privacy.set(r.id, r);
  }
  async savePrivacy(r: PrivacyRequest) {
    this.privacy.set(r.id, r);
  }
  async findPrivacy(id: string) {
    return this.privacy.get(id) ?? null;
  }
  async searchPrivacy(c: { status?: PrivacyStatus; limit: number; offset: number }) {
    const hits = [...this.privacy.values()]
      .filter((r) => !c.status || r.status === c.status)
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    return page(hits, c.offset, c.limit);
  }
  async openPrivacy() {
    return [...this.privacy.values()].filter((r) => r.status === "received" || r.status === "verifying");
  }
}

/** Until a mail provider is configured, replies are stored but reported as not delivered. */
export class UnconfiguredMailer implements Mailer {
  async send() {
    return false;
  }
}
