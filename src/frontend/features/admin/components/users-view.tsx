"use client";

import { useState, type FormEvent } from "react";
import { humanize } from "@/frontend/shared/lib/format";
import { Button } from "@/frontend/shared/ui/button";
import { ChipSelect, Input, Textarea } from "@/frontend/shared/ui/form";
import { Card } from "@/frontend/shared/ui/surface";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { Tag, type TagTone } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import type { UserRow } from "../api/schemas";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, ConfirmButton, DetailRow, EmptyState, Notice, Pagination, QueryBoundary, SectionTitle } from "./admin-ui";

const PAGE_SIZE = 20;
const STATUS_TONE: Record<string, TagTone> = {
  active: "ok",
  restricted: "medium",
  suspended: "medium",
  banned: "high",
  deleted: "neutral",
};

export function UsersView() {
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const query = useAdminQuery(`users:${q}:${status}:${offset}`, () =>
    adminApi.users({ q: q.trim(), status, limit: PAGE_SIZE, offset }),
  );

  function onSearch(event: FormEvent) {
    event.preventDefault();
    setQ(draft);
    setOffset(0);
  }

  return (
    <AdminPage breadcrumb="Admin / Users" title="Users">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} role="search">
          <Input
            aria-label="Search by name or ID"
            placeholder="Search by name or ID"
            maxLength={60}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="!h-9 !w-60 !rounded-full !px-3 !py-0 text-p2"
          />
        </form>
        <ChipSelect
          label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">Status: All</option>
          {["active", "restricted", "suspended", "banned", "deleted"].map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </ChipSelect>
      </div>

      <QueryBoundary query={query}>
        {(page) => {
          const user = page.items.find((u) => u.id === selected) ?? page.items[0];
          return (
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-[2_1_560px]">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>User</Th>
                      <Th>Status</Th>
                      <Th>Reports</Th>
                      <Th>Flags against</Th>
                      <Th>Blocks against</Th>
                      <Th>
                        <span className="sr-only">Open</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((u) => (
                      <tr key={u.id} className={u.id === user?.id ? "bg-muted/60" : ""}>
                        <Td className="font-bold">{u.label}</Td>
                        <Td>
                          <Tag tone={STATUS_TONE[u.status]}>{humanize(u.status)}</Tag>
                        </Td>
                        <Td>{u.status === "deleted" ? `${u.reports} (kept)` : u.reports}</Td>
                        <Td>{u.flagsAgainst}</Td>
                        <Td>{u.blocksAgainst ?? "—"}</Td>
                        <Td>
                          <button
                            type="button"
                            aria-pressed={u.id === user?.id}
                            onClick={() => setSelected(u.id)}
                            className="cursor-pointer font-bold underline"
                          >
                            Open
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                {page.items.length === 0 && <EmptyState>No users match.</EmptyState>}
                <Pagination offset={offset} pageSize={PAGE_SIZE} total={page.total} shown={page.items.length} onChange={setOffset} />
              </div>

              {user && <UserPanel key={user.id} user={user} onChanged={query.reload} />}
            </div>
          );
        }}
      </QueryBoundary>
    </AdminPage>
  );
}

function UserPanel({ user, onChanged }: { user: UserRow; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const action = useAction();
  const deleted = user.status === "deleted";
  const ready = reason.trim().length >= 3 && !action.pending && !deleted;

  async function act(kind: "warn" | "suspend" | "ban" | "restore") {
    const result = await action.run(() => adminApi.userAction(user.id, { action: kind, reason: reason.trim() }));
    if (result) {
      setDone(`${humanize(kind)} applied. It’s in the audit log.`);
      setReason("");
      onChanged();
    }
  }

  return (
    <Card className="min-w-0 flex-[1_1_300px]">
      <SectionTitle>{user.label}</SectionTitle>
      <Tag tone={STATUS_TONE[user.status]}>{humanize(user.status)}</Tag>
      <div className="mt-1">
        <DetailRow label="Reports">{user.reports}</DetailRow>
        <DetailRow label="Updates">{user.updates}</DetailRow>
        <DetailRow label="Flags against">{user.flagsAgainst}</DetailRow>
        <DetailRow label="Warnings">{user.warnings}</DetailRow>
        <DetailRow label="Blocked by" last>
          {user.blocksAgainst === null ? "—" : `${user.blocksAgainst} users`}
        </DetailRow>
      </div>
      {!deleted && (
        <>
          <label htmlFor="user-reason" className="sr-only">
            Reason (required)
          </label>
          <Textarea
            id="user-reason"
            rows={2}
            className="mt-3"
            placeholder="Reason (required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!ready} onClick={() => act("warn")}>
              Warn
            </Button>
            <Button size="sm" variant="outline" disabled={!ready} onClick={() => act("suspend")}>
              Suspend
            </Button>
            <ConfirmButton size="sm" label="Ban" confirmLabel="Confirm ban" disabled={!ready} onConfirm={() => act("ban")} />
            <Button
              size="sm"
              variant="outline"
              disabled={!ready || user.status === "active"}
              onClick={() => act("restore")}
            >
              Restore
            </Button>
          </div>
        </>
      )}
      <div className="mt-2 space-y-2" aria-live="polite">
        {action.error && <Notice tone="error">{action.error}</Notice>}
        {done && <Notice>{done}</Notice>}
      </div>
      <p className="mt-2 text-p3 text-ink-muted">
        Deleted users show only a tombstone ID, their reports and moderation history. No personal data.
      </p>
    </Card>
  );
}
