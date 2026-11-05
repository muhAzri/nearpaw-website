"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { formatRelativeTime } from "@/frontend/shared/lib/format";
import { Button } from "@/frontend/shared/ui/button";
import { ChipSelect, Input } from "@/frontend/shared/ui/form";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { UrgencyTag } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, EmptyState, Pagination, QueryBoundary, ReportStateTag } from "./admin-ui";

const PAGE_SIZE = 20;

interface Filters {
  q: string;
  state: string;
  regionId: string;
  animal: string;
  urgency: string;
  from: string;
  to: string;
  sort: "newest" | "most_flags";
  offset: number;
}

const INITIAL: Filters = { q: "", state: "", regionId: "", animal: "", urgency: "", from: "", to: "", sort: "newest", offset: 0 };

export function ReportsView() {
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [search, setSearch] = useState("");
  const regions = useAdminQuery("regions", adminApi.regions);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value, offset: key === "offset" ? (value as number) : 0 }));

  const query = useAdminQuery(`reports:${JSON.stringify(filters)}`, () =>
    adminApi.reports({
      q: filters.q.trim().toUpperCase(),
      state: filters.state,
      regionId: filters.regionId,
      animal: filters.animal,
      urgency: filters.urgency,
      from: filters.from,
      to: filters.to ? `${filters.to}T23:59:59.999Z` : "",
      sort: filters.sort,
      limit: PAGE_SIZE,
      offset: filters.offset,
    }),
  );

  function onSearch(event: FormEvent) {
    event.preventDefault();
    set("q", search);
  }

  const dirty = JSON.stringify({ ...filters, offset: 0 }) !== JSON.stringify(INITIAL);

  return (
    <AdminPage
      breadcrumb="Admin / Reports"
      title="Reports"
      description="Reports go live automatically. Use this list to find, review and act on any report."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} role="search" className="flex">
          <Input
            aria-label="Search by reference ID"
            placeholder="Search by reference ID"
            maxLength={20}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!h-9 !w-60 !rounded-full !px-3 !py-0 text-p2"
          />
        </form>
        <ChipSelect label="State" value={filters.state} onChange={(e) => set("state", e.target.value)}>
          <option value="">State: All</option>
          <option value="live">Live</option>
          <option value="hidden">Hidden</option>
          <option value="closed">Closed</option>
          <option value="expired">Expired</option>
          <option value="removed">Removed</option>
        </ChipSelect>
        <ChipSelect label="Region" value={filters.regionId} onChange={(e) => set("regionId", e.target.value)}>
          <option value="">Region: All</option>
          {regions.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </ChipSelect>
        <ChipSelect label="Animal" value={filters.animal} onChange={(e) => set("animal", e.target.value)}>
          <option value="">Animal: All</option>
          <option value="cat">Cat</option>
          <option value="dog">Dog</option>
          <option value="wildlife">Wildlife</option>
          <option value="other">Other</option>
        </ChipSelect>
        <ChipSelect label="Urgency" value={filters.urgency} onChange={(e) => set("urgency", e.target.value)}>
          <option value="">Urgency: All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </ChipSelect>
        <label className="flex items-center gap-1.5 text-p3 text-ink-muted">
          From
          <input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => set("from", e.target.value)}
            className="min-h-9 rounded-full border border-border bg-surface px-3 text-p2 font-semibold text-ink"
          />
        </label>
        <label className="flex items-center gap-1.5 text-p3 text-ink-muted">
          To
          <input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => set("to", e.target.value)}
            className="min-h-9 rounded-full border border-border bg-surface px-3 text-p2 font-semibold text-ink"
          />
        </label>
        <ChipSelect label="Sort" value={filters.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])}>
          <option value="newest">Sort: newest</option>
          <option value="most_flags">Sort: most flags</option>
        </ChipSelect>
        {dirty && (
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              setFilters(INITIAL);
              setSearch("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <QueryBoundary query={query}>
        {(page) => (
          <>
            <DataTable aria-busy={query.loading}>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Report</Th>
                  <Th>Region</Th>
                  <Th>Urgency</Th>
                  <Th>State</Th>
                  <Th>Flags</Th>
                  <Th>Posted</Th>
                  <Th>
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((r) => (
                  <tr key={r.ref}>
                    <Td className="font-bold">{r.ref}</Td>
                    <Td>{r.title}</Td>
                    <Td>{r.region ?? "—"}</Td>
                    <Td>
                      <UrgencyTag urgency={r.urgency} />
                    </Td>
                    <Td>
                      <ReportStateTag state={r.state} hiddenBy={r.hiddenBy} />
                    </Td>
                    <Td>{r.flags}</Td>
                    <Td>{formatRelativeTime(r.createdAt)}</Td>
                    <Td>
                      <Link href={`/admin/reports/${r.ref}`} className="font-bold underline">
                        Open
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            {page.items.length === 0 && <EmptyState>No reports match these filters.</EmptyState>}
            <Pagination
              offset={filters.offset}
              pageSize={PAGE_SIZE}
              total={page.total}
              shown={page.items.length}
              onChange={(offset) => set("offset", offset)}
            />
          </>
        )}
      </QueryBoundary>
    </AdminPage>
  );
}
