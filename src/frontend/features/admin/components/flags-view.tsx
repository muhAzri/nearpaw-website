"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMinutes, humanize } from "@/frontend/shared/lib/format";
import { labelOf } from "@/frontend/shared/lib/labels";
import { Button } from "@/frontend/shared/ui/button";
import { ChipButton } from "@/frontend/shared/ui/chip";
import { Radio, Textarea } from "@/frontend/shared/ui/form";
import { Card } from "@/frontend/shared/ui/surface";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { adminApi } from "../api/admin-api";
import type { FlagRow } from "../api/schemas";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, EmptyState, Notice, Pagination, QueryBoundary, SectionTitle } from "./admin-ui";

const PAGE_SIZE = 20;
const OUTCOMES = [
  { value: "none", label: "No action" },
  { value: "hide", label: "Hide content" },
  { value: "warn", label: "Warn user" },
  { value: "restrict", label: "Restrict user" },
] as const;
type Outcome = (typeof OUTCOMES)[number]["value"];

const TARGET_LABEL = { report: "Report", update: "Update", user: "User" } as const;

function targetHref(flag: FlagRow): string {
  if (flag.targetType === "report") return `/admin/reports/${flag.targetRef}`;
  return flag.targetType === "update" ? "/admin/updates" : "/admin/users";
}

export function FlagsView() {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const query = useAdminQuery(`flags:${status}:${offset}`, () => adminApi.flags(status, offset));

  return (
    <AdminPage
      breadcrumb="Admin / Flags"
      title="Flags"
      description="Timely handling matters for App Store review. Oldest first."
    >
      <div className="mb-4 flex gap-2">
        {(["open", "resolved"] as const).map((s) => (
          <ChipButton
            key={s}
            compact
            on={status === s}
            onClick={() => {
              setStatus(s);
              setOffset(0);
              setSelected(null);
            }}
          >
            {humanize(s)}
          </ChipButton>
        ))}
      </div>

      <QueryBoundary query={query}>
        {(page) => {
          const flag = page.items.find((f) => f.number === selected) ?? page.items[0];
          return (
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-[2_1_560px]">
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Flag</Th>
                      <Th>Target</Th>
                      <Th>Ref</Th>
                      <Th>Reason</Th>
                      <Th>Flags on target</Th>
                      <Th>Age</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((f) => (
                      <tr key={f.id} className={f.number === flag?.number ? "bg-muted/60" : ""}>
                        <Td>
                          <button
                            type="button"
                            aria-pressed={f.number === flag?.number}
                            onClick={() => setSelected(f.number)}
                            className="cursor-pointer font-bold underline"
                          >
                            #{f.number}
                          </button>
                        </Td>
                        <Td>{TARGET_LABEL[f.targetType]}</Td>
                        <Td className="font-bold">{f.targetRef}</Td>
                        <Td>{labelOf("flagReason", f.reason)}</Td>
                        <Td>{f.flagsOnTarget}</Td>
                        <Td>{formatMinutes(f.ageMinutes)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
                {page.items.length === 0 && (
                  <EmptyState>{status === "open" ? "No open flags. Nice and quiet." : "Nothing resolved yet."}</EmptyState>
                )}
                <Pagination offset={offset} pageSize={PAGE_SIZE} total={page.total} shown={page.items.length} onChange={setOffset} />
              </div>

              {flag && <FlagPanel key={flag.number} flag={flag} onResolved={query.reload} />}
            </div>
          );
        }}
      </QueryBoundary>
    </AdminPage>
  );
}

function FlagPanel({ flag, onResolved }: { flag: FlagRow; onResolved: () => void }) {
  const [outcome, setOutcome] = useState<Outcome>("none");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const action = useAction();
  const resolved = flag.status === "resolved";
  // Users have no content to hide.
  const options = flag.targetType === "user" ? OUTCOMES.filter((o) => o.value !== "hide") : OUTCOMES;

  async function resolve() {
    const result = await action.run(() => adminApi.resolveFlag(flag.number, { outcome, notes: notes.trim() }));
    if (result) {
      setDone(`Flag #${flag.number} resolved${result.resolvedFlags > 1 ? ` (${result.resolvedFlags} flags on the same target closed)` : ""}.`);
      onResolved();
    }
  }

  return (
    <Card className="min-w-0 flex-[1_1_300px]">
      <SectionTitle>
        Flag #{flag.number} · {TARGET_LABEL[flag.targetType]} {flag.targetRef}
      </SectionTitle>
      <p className="text-p2 text-ink-muted">
        {flag.flagsOnTarget} {flag.flagsOnTarget === 1 ? "person has" : "people have"} flagged this · {labelOf("flagReason", flag.reason).toLowerCase()}.
      </p>
      {flag.details && <p className="mt-1 text-p2">“{flag.details}”</p>}
      <Link href={targetHref(flag)} className="mt-1 inline-block text-p2 font-bold underline">
        {flag.targetType === "report" ? "Open report →" : flag.targetType === "update" ? "Open updates →" : "Open users →"}
      </Link>

      {resolved ? (
        <p className="mt-4 text-p2">
          Resolved: <span className="font-bold">{OUTCOMES.find((o) => o.value === flag.outcome)?.label ?? humanize(flag.outcome ?? "none")}</span>
        </p>
      ) : (
        <>
          <fieldset className="mt-4">
            <legend className="eyebrow">Outcome</legend>
            <div className="-mx-1 mt-1 flex flex-col">
              {options.map((o) => (
                <Radio
                  key={o.value}
                  name={`outcome-${flag.number}`}
                  label={o.label}
                  checked={outcome === o.value}
                  onChange={() => setOutcome(o.value)}
                  className="px-1 py-2.5"
                />
              ))}
            </div>
          </fieldset>
          <label htmlFor="flag-notes" className="sr-only">
            Notes (required)
          </label>
          <Textarea
            id="flag-notes"
            rows={3}
            className="mt-2"
            placeholder="Notes (required)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button block size="md" className="mt-3" disabled={notes.trim().length < 3 || action.pending} onClick={resolve}>
            {action.pending ? "Resolving…" : "Resolve flag"}
          </Button>
          <div className="mt-2 space-y-2" aria-live="polite">
            {action.error && <Notice tone="error">{action.error}</Notice>}
            {done && <Notice>{done}</Notice>}
          </div>
        </>
      )}
    </Card>
  );
}
