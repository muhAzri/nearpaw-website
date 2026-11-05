"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateTime, formatMinutes, humanize } from "@/frontend/shared/lib/format";
import { labelOf } from "@/frontend/shared/lib/labels";
import { Button } from "@/frontend/shared/ui/button";
import { ChipButton } from "@/frontend/shared/ui/chip";
import { Checkbox, ChipSelect, Input, Textarea } from "@/frontend/shared/ui/form";
import { Card } from "@/frontend/shared/ui/surface";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { Tag, type TagTone } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import type { PrivacyDetail, PrivacyRow, SupportDetail, SupportRow } from "../api/schemas";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, ConfirmButton, EmptyState, Notice, Pagination, QueryBoundary, SectionTitle } from "./admin-ui";

const PAGE_SIZE = 20;
const SUPPORT_TONE: Record<string, TagTone> = { new: "medium", assigned: "neutral", resolved: "ok" };
const PRIVACY_TONE: Record<string, TagTone> = { received: "medium", verifying: "neutral", completed: "ok", rejected: "neutral" };

export function SupportInboxView() {
  const [tab, setTab] = useState<"support" | "privacy">("support");
  const newMessages = useAdminQuery("support-new", () => adminApi.supportMessages({ status: "new", limit: 1 }));
  const newRequests = useAdminQuery("privacy-new", () => adminApi.privacyRequests({ status: "received", limit: 1 }));

  return (
    <AdminPage breadcrumb="Admin / Support inbox" title="Support & privacy requests">
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Inbox">
        <ChipButton compact role="tab" aria-selected={tab === "support"} on={tab === "support"} onClick={() => setTab("support")}>
          Support messages{newMessages.data ? ` · ${newMessages.data.total}` : ""}
        </ChipButton>
        <ChipButton compact role="tab" aria-selected={tab === "privacy"} on={tab === "privacy"} onClick={() => setTab("privacy")}>
          Privacy requests{newRequests.data ? ` · ${newRequests.data.total}` : ""}
        </ChipButton>
      </div>
      {tab === "support" ? (
        <SupportTab onChanged={newMessages.reload} />
      ) : (
        <PrivacyTab onChanged={newRequests.reload} />
      )}
    </AdminPage>
  );
}

// ---------------------------------------------------------------- support messages

function SupportTab({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useAdminQuery(`support:${status}:${topic}:${language}:${offset}`, () =>
    adminApi.supportMessages({ status, topic, language, limit: PAGE_SIZE, offset }),
  );
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <ChipSelect label="Status" value={status} onChange={(e) => reset(setStatus)(e.target.value)}>
          <option value="">Status: All</option>
          <option value="new">New</option>
          <option value="assigned">Assigned</option>
          <option value="resolved">Resolved</option>
        </ChipSelect>
        <ChipSelect label="Topic" value={topic} onChange={(e) => reset(setTopic)(e.target.value)}>
          <option value="">Topic: All</option>
          {["content_abuse", "bug", "privacy", "press", "other"].map((t) => (
            <option key={t} value={t}>
              {labelOf("supportTopic", t)}
            </option>
          ))}
        </ChipSelect>
        <ChipSelect label="Language" value={language} onChange={(e) => reset(setLanguage)(e.target.value)}>
          <option value="">Language: All</option>
          <option value="en">English</option>
          <option value="id">Bahasa Indonesia</option>
        </ChipSelect>
      </div>
      <QueryBoundary query={query}>
        {(page) => {
          const row = page.items.find((m) => m.id === selected) ?? page.items[0];
          return (
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-[1_1_440px]">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>From</Th>
                      <Th>Topic</Th>
                      <Th>Age</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((m: SupportRow) => (
                      <tr key={m.id} className={m.id === row?.id ? "bg-muted/60" : ""}>
                        <Td>
                          <button type="button" aria-pressed={m.id === row?.id} onClick={() => setSelected(m.id)} className="cursor-pointer text-left font-bold underline">
                            {m.from}
                          </button>
                        </Td>
                        <Td>{labelOf("supportTopic", m.topic)}</Td>
                        <Td>{formatMinutes(m.ageMinutes)}</Td>
                        <Td>
                          <Tag tone={SUPPORT_TONE[m.status]}>{humanize(m.status)}</Tag>
                          {m.escalated && <Tag tone="high" className="ml-1">Escalated</Tag>}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                {page.items.length === 0 && <EmptyState>The inbox is empty.</EmptyState>}
                <Pagination offset={offset} pageSize={PAGE_SIZE} total={page.total} shown={page.items.length} onChange={setOffset} />
              </div>
              {row && (
                <SupportPanel
                  key={row.id}
                  id={row.id}
                  onChanged={() => {
                    query.reload();
                    onChanged();
                  }}
                />
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </>
  );
}

function SupportPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const detail = useAdminQuery(`support-detail:${id}`, () => adminApi.supportMessage(id));
  return (
    <div className="min-w-0 flex-[1_1_440px]">
      <QueryBoundary query={detail}>
        {(m) => <SupportDetailCard message={m} onChanged={() => { detail.reload(); onChanged(); }} />}
      </QueryBoundary>
    </div>
  );
}

function SupportDetailCard({ message, onChanged }: { message: SupportDetail; onChanged: () => void }) {
  const [reply, setReply] = useState("");
  const [assignee, setAssignee] = useState(message.assignee ?? "");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const action = useAction();
  const resolved = message.status === "resolved";

  async function act(body: Parameters<typeof adminApi.supportAct>[1], success: string, after?: () => void) {
    const result = await action.run(() => adminApi.supportAct(message.id, body));
    if (result) {
      setDone(success);
      after?.();
      onChanged();
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-[15px] leading-[26px]">{labelOf("supportTopic", message.topic)}</h2>
        <Tag tone={SUPPORT_TONE[message.status]}>{humanize(message.status)}</Tag>
      </div>
      <p className="text-p3 text-ink-muted">
        {message.from} · {message.language === "id" ? "Bahasa Indonesia" : "English"} · {message.ref}
        {message.reportRef && (
          <>
            {" · linked report "}
            <Link href={`/admin/reports/${message.reportRef}`} className="underline">
              {message.reportRef}
            </Link>
          </>
        )}
      </p>
      <p className="mt-2.5 whitespace-pre-wrap rounded-xl bg-muted px-3 py-3 text-p1">“{message.message}”</p>

      {message.replies.map((r) => (
        <div key={r.at} className="mt-3 rounded-xl border border-border px-3 py-2.5">
          <p className="text-p3 text-ink-muted">
            Reply · {formatDateTime(r.at)} · {r.delivered ? "emailed" : "saved, not emailed (email sending isn’t connected yet)"}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-p2">{r.body}</p>
        </div>
      ))}
      {message.notes.length > 0 && (
        <div className="mt-3">
          <p className="eyebrow">Internal notes</p>
          {message.notes.map((n) => (
            <p key={n.at} className="mt-1 text-p2">
              {n.body} <span className="text-p3 text-ink-muted">· {formatDateTime(n.at)}</span>
            </p>
          ))}
        </div>
      )}

      {!resolved && (
        <>
          <label htmlFor="support-reply" className="mt-4 block text-p2 font-bold">
            Reply
          </label>
          <Textarea id="support-reply" rows={3} className="mt-1" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Hi, thanks for flagging this…" />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" disabled={reply.trim().length < 2 || action.pending} onClick={() => act({ action: "reply", body: reply.trim() }, "Reply saved.", () => setReply(""))}>
              Send reply
            </Button>
            <Button size="sm" variant="outline" disabled={action.pending} onClick={() => act({ action: "resolve" }, "Marked resolved.")}>
              Mark resolved
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <label htmlFor="support-assignee" className="text-p2 font-bold">
                Assign to
              </label>
              <Input id="support-assignee" className="mt-1 !py-2" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Name" maxLength={60} />
            </div>
            <Button size="sm" variant="outline" disabled={!assignee.trim() || action.pending} onClick={() => act({ action: "assign", assignee: assignee.trim() }, `Assigned to ${assignee.trim()}.`)}>
              Assign
            </Button>
          </div>

          <label htmlFor="support-note" className="mt-4 block text-p2 font-bold">
            Internal note
          </label>
          <Textarea id="support-note" rows={2} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Never sent to the sender" />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!note.trim() || action.pending} onClick={() => act({ action: "note", note: note.trim() }, "Note added.", () => setNote(""))}>
              Add note
            </Button>
            <Button size="sm" variant="outline" disabled={note.trim().length < 3 || action.pending || message.escalated} onClick={() => act({ action: "escalate", note: note.trim() }, "Escalated.", () => setNote(""))}>
              {message.escalated ? "Escalated" : "Escalate"}
            </Button>
          </div>
        </>
      )}
      <div className="mt-3 space-y-2" aria-live="polite">
        {action.error && <Notice tone="error">{action.error}</Notice>}
        {done && !action.error && <Notice>{done}</Notice>}
      </div>
      <p className="mt-2 text-p3 text-ink-muted">Internal notes are never sent. Every action is audited.</p>
    </Card>
  );
}

// ---------------------------------------------------------------- privacy requests

function PrivacyTab({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useAdminQuery(`privacy:${status}:${offset}`, () => adminApi.privacyRequests({ status, limit: PAGE_SIZE, offset }));

  return (
    <>
      <div className="mb-4">
        <ChipSelect
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Status: All</option>
          {["received", "verifying", "completed", "rejected"].map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </ChipSelect>
      </div>
      <QueryBoundary query={query}>
        {(page) => {
          const row = page.items.find((r) => r.id === selected) ?? page.items[0];
          return (
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-[1_1_440px]">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>From</Th>
                      <Th>Type</Th>
                      <Th>Due</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((r: PrivacyRow) => (
                      <tr key={r.id} className={r.id === row?.id ? "bg-muted/60" : ""}>
                        <Td>
                          <button type="button" aria-pressed={r.id === row?.id} onClick={() => setSelected(r.id)} className="cursor-pointer text-left font-bold underline">
                            {r.from}
                          </button>
                          <span className="block text-p3 text-ink-muted">{r.ref}</span>
                        </Td>
                        <Td>{labelOf("privacyType", r.type)}</Td>
                        <Td>
                          <DueTag request={r} />
                        </Td>
                        <Td>
                          <Tag tone={PRIVACY_TONE[r.status]}>{humanize(r.status)}</Tag>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                {page.items.length === 0 && <EmptyState>No privacy requests.</EmptyState>}
                <Pagination offset={offset} pageSize={PAGE_SIZE} total={page.total} shown={page.items.length} onChange={setOffset} />
              </div>
              {row && (
                <PrivacyPanel
                  key={row.id}
                  id={row.id}
                  onChanged={() => {
                    query.reload();
                    onChanged();
                  }}
                />
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </>
  );
}

function DueTag({ request }: { request: Pick<PrivacyRow, "status" | "dueInDays"> }) {
  if (request.status === "completed" || request.status === "rejected") return <span className="text-ink-muted">—</span>;
  if (request.dueInDays < 0) return <Tag tone="high">Overdue</Tag>;
  if (request.dueInDays <= 5) return <Tag tone="high">Due in {request.dueInDays} {request.dueInDays === 1 ? "day" : "days"}</Tag>;
  return <span>{request.dueInDays} days</span>;
}

function PrivacyPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const detail = useAdminQuery(`privacy-detail:${id}`, () => adminApi.privacyRequest(id));
  return (
    <div className="min-w-0 flex-[1_1_440px]">
      <QueryBoundary query={detail}>
        {(r) => <PrivacyDetailCard request={r} onChanged={() => { detail.reload(); onChanged(); }} />}
      </QueryBoundary>
    </div>
  );
}

function PrivacyDetailCard({ request, onChanged }: { request: PrivacyDetail; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const action = useAction();
  const closed = request.status === "completed" || request.status === "rejected";

  async function patch(body: Parameters<typeof adminApi.updatePrivacyRequest>[1], success: string, after?: () => void) {
    const result = await action.run(() => adminApi.updatePrivacyRequest(request.id, body));
    if (result) {
      setDone(success);
      after?.();
      onChanged();
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-[15px] leading-[26px]">{labelOf("privacyType", request.type)} request</h2>
        <Tag tone={PRIVACY_TONE[request.status]}>{humanize(request.status)}</Tag>
      </div>
      <p className="text-p3 text-ink-muted">
        {request.from} · {request.ref} · <DueTag request={request} />
      </p>
      {request.accountIdentifier && (
        <p className="mt-2 text-p2">
          <span className="text-ink-muted">Account identifier:</span> <span className="font-bold">{request.accountIdentifier}</span>
        </p>
      )}
      <p className="mt-2.5 whitespace-pre-wrap rounded-xl bg-muted px-3 py-3 text-p1">“{request.details}”</p>

      <SectionTitle>Identity checklist</SectionTitle>
      <div className="flex flex-col gap-2">
        <Checkbox
          label="Email matches the account"
          checked={request.checklist.emailMatchesAccount}
          disabled={closed || action.pending}
          onChange={(e) => patch({ emailMatchesAccount: e.target.checked }, "Checklist updated.")}
        />
        <Checkbox
          label="Extra proof received"
          checked={request.checklist.extraProofReceived}
          disabled={closed || action.pending}
          onChange={(e) => patch({ extraProofReceived: e.target.checked }, "Checklist updated.")}
        />
      </div>

      {request.notes.length > 0 && (
        <div className="mt-3">
          <p className="eyebrow">Internal notes</p>
          {request.notes.map((n) => (
            <p key={n.at} className="mt-1 text-p2">
              {n.body} <span className="text-p3 text-ink-muted">· {formatDateTime(n.at)}</span>
            </p>
          ))}
        </div>
      )}

      {!closed && (
        <>
          <label htmlFor="privacy-note" className="mt-4 block text-p2 font-bold">
            Internal note
          </label>
          <Textarea id="privacy-note" rows={2} className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!note.trim() || action.pending} onClick={() => patch({ note: note.trim() }, "Note added.", () => setNote(""))}>
              Add note
            </Button>
            {request.status === "received" && (
              <Button size="sm" variant="outline" disabled={action.pending} onClick={() => patch({ status: "verifying" }, "Marked as verifying.")}>
                Start verifying
              </Button>
            )}
            <Button
              size="sm"
              disabled={!request.checklist.emailMatchesAccount || action.pending}
              title={request.checklist.emailMatchesAccount ? undefined : "Confirm the email matches the account first"}
              onClick={() => patch({ status: "completed" }, "Request completed.")}
            >
              Mark completed
            </Button>
            <ConfirmButton size="sm" label="Reject" confirmLabel="Confirm reject" disabled={action.pending} onConfirm={() => patch({ status: "rejected" }, "Request rejected.")} />
          </div>
        </>
      )}
      <div className="mt-3 space-y-2" aria-live="polite">
        {action.error && <Notice tone="error">{action.error}</Notice>}
        {done && !action.error && <Notice>{done}</Notice>}
      </div>
      <p className="mt-2 text-p3 text-ink-muted">
        We verify identity before sharing anything. Completing a request needs the email to match the account. Every action is audited.
      </p>
    </Card>
  );
}
