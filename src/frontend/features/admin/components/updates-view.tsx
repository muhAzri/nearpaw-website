"use client";

import Link from "next/link";
import { useState } from "react";
import { labelOf } from "@/frontend/shared/lib/labels";
import { ChipButton } from "@/frontend/shared/ui/chip";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { Tag } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import type { UpdateRow } from "../api/schemas";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, EmptyState, Notice, Pagination, QueryBoundary, ReasonDialog } from "./admin-ui";

const PAGE_SIZE = 20;
const FILTERS = [
  { value: "flagged", label: "Flagged" },
  { value: "all", label: "All" },
  { value: "hidden", label: "Hidden" },
] as const;

export function UpdatesView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("flagged");
  const [offset, setOffset] = useState(0);
  const [target, setTarget] = useState<{ update: UpdateRow; decision: "hide" | "keep" } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const action = useAction();

  const query = useAdminQuery(`updates:${filter}:${offset}`, () => adminApi.updates(filter, offset));

  async function confirm(reason: string) {
    if (!target) return;
    const result = await action.run(() => adminApi.decideUpdate(target.update.id, { decision: target.decision, reason }));
    if (result) {
      setSaved(`Update ${target.update.ref} ${target.decision === "hide" ? "hidden" : "kept live"}.`);
      setTarget(null);
      query.reload();
    }
  }

  return (
    <AdminPage
      breadcrumb="Admin / Updates"
      title="Updates"
      description="Community updates are posted right away. Review the flagged ones."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <ChipButton
            key={f.value}
            compact
            on={filter === f.value}
            onClick={() => {
              setFilter(f.value);
              setOffset(0);
            }}
          >
            {f.label}
          </ChipButton>
        ))}
      </div>
      {saved && (
        <div className="mb-3">
          <Notice>{saved}</Notice>
        </div>
      )}

      <QueryBoundary query={query}>
        {(page) => (
          <>
            <DataTable>
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th>Report</Th>
                  <Th>Note</Th>
                  <Th>Media</Th>
                  <Th>State</Th>
                  <Th>Flags</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((u) => (
                  <tr key={u.id}>
                    <Td className="font-bold">{labelOf("updateType", u.type)}</Td>
                    <Td>
                      <Link href={`/admin/reports/${u.reportRef}`} className="underline">
                        {u.reportRef}
                      </Link>
                      <span className="block text-p3 text-ink-muted">{u.ref}</span>
                    </Td>
                    <Td className="max-w-[260px]">{u.note ? `“${u.note}”` : "—"}</Td>
                    <Td>{u.photos > 0 ? `${u.photos} ${u.photos === 1 ? "photo" : "photos"}` : "—"}</Td>
                    <Td>{u.state === "live" ? <Tag tone="ok">Live</Tag> : <Tag tone="notice">Hidden</Tag>}</Td>
                    <Td>{u.flags}</Td>
                    <Td className="whitespace-nowrap font-bold">
                      <button
                        type="button"
                        disabled={u.state === "hidden"}
                        onClick={() => setTarget({ update: u, decision: "hide" })}
                        className="cursor-pointer underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-45"
                      >
                        Hide
                      </button>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => setTarget({ update: u, decision: "keep" })}
                        className="cursor-pointer underline"
                      >
                        Keep
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {page.items.length === 0 && <EmptyState>No updates here.</EmptyState>}
            <Pagination offset={offset} pageSize={PAGE_SIZE} total={page.total} shown={page.items.length} onChange={setOffset} />
          </>
        )}
      </QueryBoundary>

      {target && (
        <ReasonDialog
          title={target.decision === "hide" ? "Hide this update?" : "Keep this update live?"}
          description={
            target.decision === "hide"
              ? "It disappears from the report. The author isn’t notified."
              : "Open flags on it are cleared and it stays on the report."
          }
          confirmLabel={target.decision === "hide" ? "Hide update" : "Keep live"}
          pending={action.pending}
          error={action.error}
          onConfirm={confirm}
          onCancel={() => {
            setTarget(null);
            action.clearError();
          }}
        />
      )}
    </AdminPage>
  );
}
