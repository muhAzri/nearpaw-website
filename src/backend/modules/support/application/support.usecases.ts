import type { AuditRecorder } from "@/backend/shared/application/audit";
import type { Clock } from "@/backend/shared/application/clock";
import { DAY_MS } from "@/backend/shared/application/clock";
import { maskEmail } from "@/backend/shared/domain/email";
import { ConflictError, NotFoundError, RateLimitedError } from "@/backend/shared/domain/errors";
import { actorOf, type Principal } from "@/backend/shared/domain/principal";
import { generateReference } from "@/backend/shared/domain/reference";
import type { RateLimiter } from "@/backend/shared/application/rate-limiter";
import type { SupportRepository } from "../domain/repositories";
import {
  assertCanComplete,
  PRIVACY_RESPONSE_DAYS,
  type PrivacyRequest,
  type PrivacyStatus,
  type PrivacyType,
  type SupportMessage,
  type SupportStatus,
  type SupportTopic,
} from "../domain/support";

export interface Mailer {
  /** true = accepted by the mail provider. */
  send(to: string, subject: string, body: string): Promise<boolean>;
}

const HOUR = 3_600_000;

export class SupportPublic {
  constructor(
    private readonly repo: SupportRepository,
    private readonly limiter: RateLimiter,
    private readonly clock: Clock,
  ) {}

  private async guard(kind: string, email: string, ip: string) {
    if (!(await this.limiter.allow(`${kind}:ip:${ip}`, 10, HOUR)) || !(await this.limiter.allow(`${kind}:email:${email.toLowerCase()}`, 5, HOUR))) {
      throw new RateLimitedError("Too many requests. Please try again later.");
    }
  }

  async submitMessage(
    input: { topic: SupportTopic; email: string; language: "en" | "id"; message: string; reportRef?: string },
    ip: string,
  ) {
    await this.guard("support", input.email, ip);
    const m: SupportMessage = {
      id: crypto.randomUUID(),
      ref: generateReference("SUP"),
      topic: input.topic,
      email: input.email.toLowerCase(),
      language: input.language,
      message: input.message,
      reportRef: input.reportRef ?? null,
      status: "new",
      assignee: null,
      escalated: false,
      replies: [],
      notes: [],
      createdAt: this.clock.now(),
      resolvedAt: null,
    };
    await this.repo.addMessage(m);
    return { ref: m.ref, firstReplyWithinBusinessDays: 3 };
  }

  async submitPrivacyRequest(
    input: { type: PrivacyType; email: string; accountIdentifier?: string; details: string },
    ip: string,
  ) {
    await this.guard("privacy", input.email, ip);
    const now = this.clock.now();
    const r: PrivacyRequest = {
      id: crypto.randomUUID(),
      ref: generateReference("PRV"),
      type: input.type,
      email: input.email.toLowerCase(),
      accountIdentifier: input.accountIdentifier ?? null,
      details: input.details,
      status: "received",
      emailMatchesAccount: false,
      extraProofReceived: false,
      notes: [],
      createdAt: now,
      dueAt: new Date(now.getTime() + PRIVACY_RESPONSE_DAYS * DAY_MS),
      completedAt: null,
    };
    await this.repo.addPrivacy(r);
    return { ref: r.ref, dueAt: r.dueAt.toISOString() };
  }
}

export type SupportAction =
  | { action: "reply"; body: string }
  | { action: "assign"; assignee: string }
  | { action: "escalate"; note: string }
  | { action: "resolve" }
  | { action: "note"; note: string };

export class SupportAdmin {
  constructor(
    private readonly repo: SupportRepository,
    private readonly mailer: Mailer,
    private readonly audit: AuditRecorder,
    private readonly clock: Clock,
  ) {}

  private messageRow(m: SupportMessage) {
    return {
      id: m.id,
      ref: m.ref,
      from: maskEmail(m.email),
      topic: m.topic,
      language: m.language,
      status: m.status,
      assignee: m.assignee,
      escalated: m.escalated,
      reportRef: m.reportRef,
      ageMinutes: Math.floor((this.clock.now().getTime() - m.createdAt.getTime()) / 60_000),
    };
  }

  async listMessages(c: { status?: SupportStatus; topic?: SupportTopic; language?: string; limit: number; offset: number }) {
    const page = await this.repo.searchMessages(c);
    return { items: page.items.map((m) => this.messageRow(m)), total: page.total };
  }

  async getMessage(id: string) {
    const m = await this.repo.findMessage(id);
    if (!m) throw new NotFoundError("Message not found");
    return {
      ...this.messageRow(m),
      message: m.message,
      replies: m.replies.map((r) => ({ body: r.body, at: r.at.toISOString(), delivered: r.delivered })),
      notes: m.notes.map((n) => ({ body: n.body, at: n.at.toISOString() })),
    };
  }

  async act(admin: Principal, id: string, a: SupportAction) {
    const m = await this.repo.findMessage(id);
    if (!m) throw new NotFoundError("Message not found");
    const now = this.clock.now();
    let next: SupportMessage = m;
    let reason: string | undefined;

    switch (a.action) {
      case "reply": {
        const delivered = await this.mailer.send(m.email, `Re: Nearpaw support (${m.ref})`, a.body).catch(() => false);
        next = { ...m, replies: [...m.replies, { body: a.body, at: now, delivered }], status: m.status === "new" ? "assigned" : m.status };
        break;
      }
      case "assign":
        next = { ...m, assignee: a.assignee, status: m.status === "resolved" ? "resolved" : "assigned" };
        reason = `assigned to ${a.assignee}`;
        break;
      case "escalate":
        next = { ...m, escalated: true, notes: [...m.notes, { body: a.note, at: now }] };
        reason = a.note;
        break;
      case "note":
        next = { ...m, notes: [...m.notes, { body: a.note, at: now }] };
        break;
      case "resolve":
        if (m.status === "resolved") throw new ConflictError("Already resolved");
        next = { ...m, status: "resolved", resolvedAt: now };
        break;
    }
    await this.repo.saveMessage(next);
    await this.audit.record({ actor: actorOf(admin), action: `support.${a.action}`, target: m.ref, reason });
    return this.getMessage(id);
  }

  // ---- privacy requests ----
  private privacyRow(r: PrivacyRequest) {
    const now = this.clock.now();
    return {
      id: r.id,
      ref: r.ref,
      type: r.type,
      from: maskEmail(r.email),
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      dueInDays: Math.ceil((r.dueAt.getTime() - now.getTime()) / DAY_MS),
    };
  }

  async listPrivacy(c: { status?: PrivacyStatus; limit: number; offset: number }) {
    const page = await this.repo.searchPrivacy(c);
    return { items: page.items.map((r) => this.privacyRow(r)), total: page.total };
  }

  async getPrivacy(id: string) {
    const r = await this.repo.findPrivacy(id);
    if (!r) throw new NotFoundError("Request not found");
    return {
      ...this.privacyRow(r),
      accountIdentifier: r.accountIdentifier,
      details: r.details,
      checklist: { emailMatchesAccount: r.emailMatchesAccount, extraProofReceived: r.extraProofReceived },
      notes: r.notes.map((n) => ({ body: n.body, at: n.at.toISOString() })),
    };
  }

  async updatePrivacy(
    admin: Principal,
    id: string,
    patch: { status?: Exclude<PrivacyStatus, "received">; emailMatchesAccount?: boolean; extraProofReceived?: boolean; note?: string },
  ) {
    const r = await this.repo.findPrivacy(id);
    if (!r) throw new NotFoundError("Request not found");
    const now = this.clock.now();
    let next: PrivacyRequest = {
      ...r,
      emailMatchesAccount: patch.emailMatchesAccount ?? r.emailMatchesAccount,
      extraProofReceived: patch.extraProofReceived ?? r.extraProofReceived,
      notes: patch.note ? [...r.notes, { body: patch.note, at: now }] : r.notes,
    };
    if (patch.status) {
      if (patch.status === "completed") assertCanComplete(next);
      const done = patch.status === "completed" || patch.status === "rejected";
      next = { ...next, status: patch.status, completedAt: done ? now : null };
    }
    await this.repo.savePrivacy(next);
    await this.audit.record({
      actor: actorOf(admin),
      action: "privacy_request.update",
      target: r.ref,
      metadata: { status: next.status },
    });
    return this.getPrivacy(id);
  }

  async counts() {
    const open = await this.repo.openPrivacy();
    const soon = open.filter((r) => r.dueAt.getTime() - this.clock.now().getTime() <= 5 * DAY_MS);
    return {
      unreadMessages: await this.repo.countMessages("new"),
      openPrivacyRequests: open.length,
      dueSoon: soon.length,
    };
  }
}
