import type { SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@/backend/shared/domain/page";
import { check, unwrap } from "@/backend/shared/infrastructure/supabase-admin";
import type { SupportRepository } from "../domain/repositories";
import type { PrivacyRequest, PrivacyStatus, SupportMessage, SupportStatus, SupportTopic } from "../domain/support";

type StoredNote = { body: string; at: string };
type StoredReply = { body: string; at: string; delivered: boolean };

export interface MessageRow {
  id: string;
  ref: string;
  topic: SupportTopic;
  email: string;
  language: "en" | "id";
  message: string;
  report_ref: string | null;
  status: SupportStatus;
  assignee: string | null;
  escalated: boolean;
  replies: StoredReply[];
  notes: StoredNote[];
  created_at: string;
  resolved_at: string | null;
}

export interface PrivacyRow {
  id: string;
  ref: string;
  type: PrivacyRequest["type"];
  email: string;
  account_identifier: string | null;
  details: string;
  status: PrivacyStatus;
  email_matches_account: boolean;
  extra_proof_received: boolean;
  notes: StoredNote[];
  created_at: string;
  due_at: string;
  completed_at: string | null;
}

export const messageFromRow = (r: MessageRow): SupportMessage => ({
  id: r.id,
  ref: r.ref,
  topic: r.topic,
  email: r.email,
  language: r.language,
  message: r.message,
  reportRef: r.report_ref,
  status: r.status,
  assignee: r.assignee,
  escalated: r.escalated,
  replies: r.replies.map((x) => ({ body: x.body, at: new Date(x.at), delivered: x.delivered })),
  notes: r.notes.map((x) => ({ body: x.body, at: new Date(x.at) })),
  createdAt: new Date(r.created_at),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
});

export const messageToRow = (m: SupportMessage): MessageRow => ({
  id: m.id,
  ref: m.ref,
  topic: m.topic,
  email: m.email,
  language: m.language,
  message: m.message,
  report_ref: m.reportRef,
  status: m.status,
  assignee: m.assignee,
  escalated: m.escalated,
  replies: m.replies.map((x) => ({ body: x.body, at: x.at.toISOString(), delivered: x.delivered })),
  notes: m.notes.map((x) => ({ body: x.body, at: x.at.toISOString() })),
  created_at: m.createdAt.toISOString(),
  resolved_at: m.resolvedAt?.toISOString() ?? null,
});

export const privacyFromRow = (r: PrivacyRow): PrivacyRequest => ({
  id: r.id,
  ref: r.ref,
  type: r.type,
  email: r.email,
  accountIdentifier: r.account_identifier,
  details: r.details,
  status: r.status,
  emailMatchesAccount: r.email_matches_account,
  extraProofReceived: r.extra_proof_received,
  notes: r.notes.map((x) => ({ body: x.body, at: new Date(x.at) })),
  createdAt: new Date(r.created_at),
  dueAt: new Date(r.due_at),
  completedAt: r.completed_at ? new Date(r.completed_at) : null,
});

export const privacyToRow = (p: PrivacyRequest): PrivacyRow => ({
  id: p.id,
  ref: p.ref,
  type: p.type,
  email: p.email,
  account_identifier: p.accountIdentifier,
  details: p.details,
  status: p.status,
  email_matches_account: p.emailMatchesAccount,
  extra_proof_received: p.extraProofReceived,
  notes: p.notes.map((x) => ({ body: x.body, at: x.at.toISOString() })),
  created_at: p.createdAt.toISOString(),
  due_at: p.dueAt.toISOString(),
  completed_at: p.completedAt?.toISOString() ?? null,
});

/** `support_messages` and `privacy_requests` through the secret key. */
export class SupabaseSupportRepository implements SupportRepository {
  constructor(private readonly db: SupabaseClient) {}

  async addMessage(m: SupportMessage) {
    check(await this.db.from("support_messages").insert(messageToRow(m)), "support.addMessage");
  }
  async saveMessage(m: SupportMessage) {
    check(await this.db.from("support_messages").upsert(messageToRow(m), { onConflict: "id" }), "support.saveMessage");
  }
  async findMessage(id: string) {
    const row = unwrap(await this.db.from("support_messages").select("*").eq("id", id).maybeSingle<MessageRow>(), "support.findMessage");
    return row ? messageFromRow(row) : null;
  }
  async searchMessages(c: { status?: SupportStatus; topic?: SupportTopic; language?: string; limit: number; offset: number }): Promise<Page<SupportMessage>> {
    let query = this.db.from("support_messages").select("*", { count: "exact" });
    if (c.status) query = query.eq("status", c.status);
    if (c.topic) query = query.eq("topic", c.topic);
    if (c.language) query = query.eq("language", c.language);
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(c.offset, c.offset + c.limit - 1);
    if (error) throw new Error(`support.searchMessages: ${error.message}`);
    return { items: ((data ?? []) as MessageRow[]).map(messageFromRow), total: count ?? 0 };
  }
  async countMessages(status: SupportStatus) {
    const { count, error } = await this.db.from("support_messages").select("*", { count: "exact", head: true }).eq("status", status);
    if (error) throw new Error(`support.countMessages: ${error.message}`);
    return count ?? 0;
  }

  async addPrivacy(r: PrivacyRequest) {
    check(await this.db.from("privacy_requests").insert(privacyToRow(r)), "support.addPrivacy");
  }
  async savePrivacy(r: PrivacyRequest) {
    check(await this.db.from("privacy_requests").upsert(privacyToRow(r), { onConflict: "id" }), "support.savePrivacy");
  }
  async findPrivacy(id: string) {
    const row = unwrap(await this.db.from("privacy_requests").select("*").eq("id", id).maybeSingle<PrivacyRow>(), "support.findPrivacy");
    return row ? privacyFromRow(row) : null;
  }
  async searchPrivacy(c: { status?: PrivacyStatus; limit: number; offset: number }): Promise<Page<PrivacyRequest>> {
    let query = this.db.from("privacy_requests").select("*", { count: "exact" });
    if (c.status) query = query.eq("status", c.status);
    const { data, error, count } = await query.order("due_at", { ascending: true }).range(c.offset, c.offset + c.limit - 1);
    if (error) throw new Error(`support.searchPrivacy: ${error.message}`);
    return { items: ((data ?? []) as PrivacyRow[]).map(privacyFromRow), total: count ?? 0 };
  }
  async openPrivacy() {
    const rows = unwrap(await this.db.from("privacy_requests").select("*").in("status", ["received", "verifying"]), "support.openPrivacy");
    return (rows as PrivacyRow[]).map(privacyFromRow);
  }
}
