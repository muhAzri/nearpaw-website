"use client";

import { useState } from "react";
import { formatDateTime } from "@/frontend/shared/lib/format";
import { Button } from "@/frontend/shared/ui/button";
import { ChipSelect, Input } from "@/frontend/shared/ui/form";
import { Icon } from "@/frontend/shared/ui/icon";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { adminApi } from "../api/admin-api";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, EmptyState, Notice, Pagination, QueryBoundary } from "./admin-ui";

const PAGE_SIZE = 50;

interface Filters {
  actor: string;
  action: string;
  target: string;
  from: string;
  to: string;
}
const INITIAL: Filters = { actor: "", action: "", target: "", from: "", to: "" };

function criteria(f: Filters) {
  return {
    actor: f.actor.toLowerCase(),
    action: f.action.trim(),
    target: f.target.trim(),
    from: f.from,
    to: f.to ? `${f.to}T23:59:59.999Z` : "",
  };
}

export function AuditView() {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [offset, setOffset] = useState(0);
  const exporting = useAction();

  const query = useAdminQuery(`audit:${JSON.stringify(filters)}:${offset}`, () =>
    adminApi.audit({ ...criteria(filters), limit: PAGE_SIZE, offset }),
  );

  const set = (key: keyof Filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setOffset(0);
  };

  async function exportCsv() {
    await exporting.run(async () => {
      const blob = await adminApi.auditCsv(criteria(filters));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "audit-log.csv";
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <AdminPage breadcrumb="Admin / Audit log" title="Audit log">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ChipSelect label="Actor" value={filters.actor} onChange={(e) => set("actor", e.target.value)}>
          <option value="">Actor: All</option>
          <option value="Admin">Admin</option>
          <option value="System">System</option>
        </ChipSelect>
        <Input
          aria-label="Action"
          placeholder="Action, e.g. report.hide"
          value={filters.action}
          maxLength={60}
          onChange={(e) => set("action", e.target.value)}
          className="!h-9 !w-52 !rounded-full !px-3 !py-0 text-p2"
        />
        <Input
          aria-label="Target"
          placeholder="Target, e.g. RPT-…"
          value={filters.target}
          maxLength={60}
          onChange={(e) => set("target", e.target.value)}
          className="!h-9 !w-44 !rounded-full !px-3 !py-0 text-p2"
        />
        <label className="flex items-center gap-1.5 text-p3 text-ink-muted">
          From
          <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => set("from", e.target.value)} className="min-h-9 rounded-full border border-border bg-surface px-3 text-p2 font-semibold text-ink" />
        </label>
        <label className="flex items-center gap-1.5 text-p3 text-ink-muted">
          To
          <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set("to", e.target.value)} className="min-h-9 rounded-full border border-border bg-surface px-3 text-p2 font-semibold text-ink" />
        </label>
        <span className="ml-auto" />
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting.pending}>
          <Icon name="upload" className="size-4" />
          {exporting.pending ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
      {exporting.error && (
        <div className="mb-3">
          <Notice tone="error">{exporting.error}</Notice>
        </div>
      )}

      <QueryBoundary query={query}>
        {(page) => (
          <>
            <DataTable>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Reason / metadata</Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((a) => {
                  const meta = Object.entries(a.metadata)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ");
                  return (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap">{formatDateTime(a.at)}</Td>
                      <Td>{a.actor}</Td>
                      <Td className="font-bold">{a.action}</Td>
                      <Td>{a.target}</Td>
                      <Td>{[a.reason, meta].filter(Boolean).join(" — ") || "—"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
            {page.items.length === 0 && <EmptyState>No entries match.</EmptyState>}
            <Pagination offset={offset} pageSize={PAGE_SIZE} total={page.total} shown={page.items.length} onChange={setOffset} />
            <p className="mt-2 text-p3 text-ink-muted">Read-only. No personal data or secrets are stored here.</p>
          </>
        )}
      </QueryBoundary>
    </AdminPage>
  );
}
