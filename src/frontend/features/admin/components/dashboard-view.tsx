"use client";

import Link from "next/link";
import { formatMinutes, formatRelativeTime } from "@/frontend/shared/lib/format";
import { Card } from "@/frontend/shared/ui/surface";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { UrgencyTag } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, EmptyState, QueryBoundary, SectionTitle, StatCard } from "./admin-ui";

export function DashboardView() {
  const query = useAdminQuery("dashboard", adminApi.dashboard);

  return (
    <AdminPage breadcrumb="Admin / Dashboard" title="Dashboard">
      <QueryBoundary query={query}>
        {(d) => (
          <>
            <div className="flex flex-wrap gap-4">
              <StatCard label="Live reports" value={d.liveReports} hint={`+${d.reportsLast24h} in the last 24 h`} />
              <StatCard
                label="Open flags"
                value={d.openFlags}
                hint={d.oldestOpenFlagMinutes === null ? "Nothing waiting" : `Oldest: ${formatMinutes(d.oldestOpenFlagMinutes)}`}
              />
              <StatCard label="Auto-hidden today" value={d.autoHiddenToday} hint="Hidden after repeated flags" />
              <StatCard
                label="Alerts sent (24 h)"
                value={d.alerts24h.sent}
                hint={`${d.alerts24h.failed} failed`}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-[2_1_520px]">
                <SectionTitle
                  action={
                    <Link href="/admin/reports" className="text-p2 font-bold underline">
                      View all
                    </Link>
                  }
                >
                  Newest reports
                </SectionTitle>
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Report</Th>
                      <Th>Region</Th>
                      <Th>Urgency</Th>
                      <Th>Posted</Th>
                      <Th>
                        <span className="sr-only">Open</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.newestReports.map((r) => (
                      <tr key={r.ref}>
                        <Td>
                          <span className="font-bold">{r.title}</span>
                          <span className="block text-p3 text-ink-muted">{r.ref}</span>
                        </Td>
                        <Td>{r.region ?? "—"}</Td>
                        <Td>
                          <UrgencyTag urgency={r.urgency} />
                        </Td>
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
                {d.newestReports.length === 0 && <EmptyState>No live reports yet.</EmptyState>}
              </div>

              <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                <Card>
                  <SectionTitle>Needs attention</SectionTitle>
                  <ul className="flex flex-col">
                    <AttentionRow
                      title={`${d.needsAttention.reportsWithMultipleFlags} reports with 2+ flags`}
                      detail="Still live"
                      href="/admin/flags"
                      action="Review"
                    />
                    <AttentionRow
                      title={`${d.needsAttention.privacyRequestsDueSoon} privacy requests due soon`}
                      detail="Within 5 days"
                      href="/admin/support"
                      action="Open"
                    />
                    <AttentionRow
                      title={`${d.needsAttention.unreadSupportMessages} unread support messages`}
                      href="/admin/support"
                      action="Open"
                      last
                    />
                  </ul>
                </Card>
                <Card>
                  <SectionTitle
                    action={
                      <Link href="/admin/audit" className="text-p2 font-bold underline">
                        Audit log
                      </Link>
                    }
                  >
                    Recent actions
                  </SectionTitle>
                  {d.recentActions.length === 0 && <p className="text-p2 text-ink-muted">Nothing yet.</p>}
                  {d.recentActions.map((a) => (
                    <div key={a.id} className="mt-2 first:mt-0">
                      <p className="text-p2">
                        <span className="font-bold">{a.action}</span> {a.target}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </p>
                      <p className="text-p3 text-ink-muted">
                        {a.actor} · {formatRelativeTime(a.at)}
                      </p>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </AdminPage>
  );
}

function AttentionRow({
  title,
  detail,
  href,
  action,
  last,
}: {
  title: string;
  detail?: string;
  href: string;
  action: string;
  last?: boolean;
}) {
  return (
    <li className={`flex items-center gap-3 py-2.5 first:pt-0 ${last ? "pb-0" : "border-b border-border-subtle"}`}>
      <div className="flex-1">
        <p className="text-p2 font-bold">{title}</p>
        {detail && <p className="text-p3 text-ink-muted">{detail}</p>}
      </div>
      <Link href={href} className="text-p2 font-bold underline">
        {action}
      </Link>
    </li>
  );
}
