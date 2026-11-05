"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMinutes, formatRelativeTime, humanize } from "@/frontend/shared/lib/format";
import { labelOf } from "@/frontend/shared/lib/labels";
import { Button } from "@/frontend/shared/ui/button";
import { Textarea } from "@/frontend/shared/ui/form";
import { Icon } from "@/frontend/shared/ui/icon";
import { Card } from "@/frontend/shared/ui/surface";
import { Tag } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import type { ReportReview } from "../api/schemas";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, ConfirmButton, DetailRow, Notice, QueryBoundary, ReportStateTag } from "./admin-ui";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/** Decorative street-map backdrop with the reporter's pin. The real position is in the caption and the OSM link. */
function PinMap({ lat, lng }: { lat: number; lng: number }) {
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  return (
    <>
      <div className="relative mt-2 h-60 overflow-hidden rounded-[10px] bg-[#f1efe9]">
        <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
          <rect width="400" height="240" fill="#f1efe9" />
          <rect x="290" y="20" width="90" height="70" rx="14" fill="#d9ead0" />
          <g fill="none" stroke="#fff" strokeLinecap="round">
            <path d="M-10 140 C80 110 180 170 300 130 S380 120 420 125" strokeWidth="16" />
            <path d="M130 -10 C145 90 105 170 140 260" strokeWidth="13" />
            <path d="M-10 60 H420 M270 -10 V260" strokeWidth="5" />
          </g>
        </svg>
        <div
          className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-danger"
          role="img"
          aria-label="Reporter’s pin"
        />
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-p3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-danger" />
          Reporter’s pin (shown publicly)
        </span>
        <span className="text-ink-muted">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
        <a href={osm} target="_blank" rel="noopener noreferrer" className="font-bold underline">
          Open in OpenStreetMap
        </a>
      </p>
    </>
  );
}

export function ReportReviewView({ reference }: { reference: string }) {
  const query = useAdminQuery(`report:${reference}`, () => adminApi.report(reference));
  return (
    <QueryBoundary query={query}>
      {(report) => <Review report={report} onChanged={query.reload} />}
    </QueryBoundary>
  );
}

function Review({ report, onChanged }: { report: ReportReview; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [original, setOriginal] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const action = useAction();

  const removed = report.state === "removed";
  const ready = reason.trim().length >= 3 && !action.pending && !removed;

  async function decide(decision: "keep" | "duplicate" | "hide" | "remove") {
    const saved = await action.run(() =>
      adminApi.decideReport(report.ref, {
        decision,
        reason: reason.trim(),
        duplicateOf: decision === "duplicate" ? (original ?? undefined) : undefined,
      }),
    );
    if (saved) {
      setDone(`Saved: ${decision === "keep" ? "kept live" : decision === "duplicate" ? "marked as duplicate" : decision === "hide" ? "hidden" : "removed"}. It’s in the audit log.`);
      setReason("");
      setOriginal(null);
      onChanged();
    }
  }

  return (
    <AdminPage
      breadcrumb={
        <>
          <Link href="/admin/reports" className="underline">
            Reports
          </Link>{" "}
          / {report.ref}
        </>
      }
      title={`${report.title} · ${humanize(report.state)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {report.region && <Tag>{report.region}</Tag>}
          <Tag>Language: {report.language.toUpperCase()}</Tag>
          {report.flags > 0 ? (
            <Tag tone="high">
              {report.flags} {report.flags === 1 ? "flag" : "flags"} · live for {formatMinutes(report.liveForMinutes)}
            </Tag>
          ) : (
            <Tag tone="ok">No open flags</Tag>
          )}
        </div>
      }
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <Card>
            <Eyebrow>Media · original vs processed</Eyebrow>
            {report.media.length === 0 ? (
              <p className="mt-2 text-p2 text-ink-muted">No photos on this report.</p>
            ) : (
              report.media.map((m) => (
                <div key={m.publicKey} className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { note: m.note.original, key: m.originalKey },
                    { note: m.note.public, key: m.publicKey },
                  ].map((tile) => (
                    <div key={tile.key}>
                      <div className="flex size-14 items-center justify-center rounded-xl border border-border-subtle bg-muted text-icon">
                        <Icon name="camera" className="size-7" />
                      </div>
                      <p className="mt-1 text-p3 text-ink-muted">{tile.note}</p>
                      <p className="break-all text-p3 text-icon">{tile.key}</p>
                    </div>
                  ))}
                </div>
              ))
            )}
          </Card>
          <Card>
            <Eyebrow>Report</Eyebrow>
            <DetailRow label="Animal">{labelOf("animal", report.animal)}</DetailRow>
            <DetailRow label="Condition">{humanize(report.condition)}</DetailRow>
            <DetailRow label="Urgency (reporter)">{humanize(report.urgency)}</DetailRow>
            <DetailRow label="State">
              <ReportStateTag state={report.state} hiddenBy={report.hiddenBy} />
            </DetailRow>
            {report.moderationReason && <DetailRow label="Moderation reason">{report.moderationReason}</DetailRow>}
            {report.duplicateOf && (
              <DetailRow label="Duplicate of">
                <Link href={`/admin/reports/${report.duplicateOf}`} className="underline">
                  {report.duplicateOf}
                </Link>
              </DetailRow>
            )}
            <DetailRow label="Posted">{formatRelativeTime(report.createdAt)}</DetailRow>
            <div className="flex items-start justify-between gap-4 py-2.5">
              <span className="text-p2 text-ink-muted">Description</span>
              <span className="max-w-[260px] text-right text-p2">{report.description}</span>
            </div>
          </Card>
          <Card>
            <Eyebrow>Reporter</Eyebrow>
            {report.reporter ? (
              <>
                <DetailRow label="Display name">{report.reporter.label}</DetailRow>
                <DetailRow label="History">
                  {report.reporter.history.published} published · {report.reporter.history.rejected} rejected ·{" "}
                  {report.reporter.history.flagsOnReports} flags
                </DetailRow>
                <DetailRow label="Account age" last>
                  {report.reporter.accountAgeDays} days
                </DetailRow>
              </>
            ) : (
              <p className="mt-1 text-p2 text-ink-muted">The reporter’s account is no longer available.</p>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Location</Eyebrow>
              <Tag tone="notice">Public exact pin</Tag>
            </div>
            {report.locationLabel && <p className="mt-1 text-p2">{report.locationLabel}</p>}
            <PinMap lat={report.location.lat} lng={report.location.lng} />
          </Card>
          {report.flagsDetail.length > 0 && (
            <Card>
              <Eyebrow>Open flags</Eyebrow>
              <ul className="mt-1">
                {report.flagsDetail.map((f) => (
                  <li key={f.number} className="border-b border-border-subtle py-2 last:border-b-0">
                    <p className="text-p2">
                      <span className="font-bold">#{f.number}</span> · {labelOf("flagReason", f.reason)} ·{" "}
                      <span className="text-ink-muted">{formatRelativeTime(f.at)}</span>
                    </p>
                    {f.details && <p className="text-p3 text-ink-muted">{f.details}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <Eyebrow>Possible duplicates</Eyebrow>
            {report.possibleDuplicates.length === 0 ? (
              <p className="mt-1 text-p2 text-ink-muted">Nothing similar within 500 m and 6 h.</p>
            ) : (
              <>
                {report.possibleDuplicates.map((d) => (
                  <div key={d.ref} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle py-2.5 last:border-b-0">
                    <span className="text-p2">
                      {d.title} · {d.distanceM} m away · {formatRelativeTime(d.createdAt)}
                      <span className="block text-p3 text-ink-muted">{d.ref}</span>
                    </span>
                    <span className="flex items-center gap-3 text-p2 font-bold">
                      <Link href={`/admin/reports/${d.ref}`} className="underline">
                        Compare
                      </Link>
                      <button
                        type="button"
                        aria-pressed={original === d.ref}
                        onClick={() => setOriginal(original === d.ref ? null : d.ref)}
                        className={`cursor-pointer underline ${original === d.ref ? "text-brand-deep" : ""}`}
                      >
                        {original === d.ref ? "Original ✓" : "Set as original"}
                      </button>
                    </span>
                  </div>
                ))}
                <p className="mt-2 text-p3 text-ink-muted">Merge if they are the same animal.</p>
              </>
            )}
          </Card>
        </div>

        <div className="min-w-[260px] flex-[0_1_300px]">
          <Card>
            <Eyebrow>Decision</Eyebrow>
            <label htmlFor="decision-reason" className="mt-2 block text-p2 font-bold">
              Reason (required)
            </label>
            <Textarea
              id="decision-reason"
              className="mt-1"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this decision?"
              disabled={removed}
            />
            <div className="mt-3 flex flex-col gap-2">
              <Button block disabled={!ready} onClick={() => decide("keep")}>
                Keep live
              </Button>
              <Button
                block
                variant="soft"
                disabled={!ready || !original}
                title={original ? undefined : "Pick the original report first"}
                onClick={() => decide("duplicate")}
              >
                Mark duplicate
              </Button>
              <Button block variant="soft" disabled={!ready} onClick={() => decide("hide")}>
                Hide
              </Button>
              <ConfirmButton
                block
                label="Remove report"
                confirmLabel="Confirm remove"
                disabled={!ready}
                onConfirm={() => decide("remove")}
              />
            </div>
            <div className="mt-3 space-y-2" aria-live="polite">
              {action.error && <Notice tone="error">{action.error}</Notice>}
              {done && !action.error && <Notice>{done}</Notice>}
              {removed && <Notice tone="error">This report was removed and can’t be changed.</Notice>}
            </div>
            <p className="mt-2.5 text-p3 text-ink-muted">
              Reports go live automatically. This screen is for flagged or auto-hidden reports: keep, hide or remove. Every
              action is written to the audit log.
            </p>
          </Card>
        </div>
      </div>
    </AdminPage>
  );
}
