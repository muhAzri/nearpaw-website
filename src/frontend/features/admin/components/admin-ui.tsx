"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/frontend/shared/ui/button";
import { Textarea } from "@/frontend/shared/ui/form";
import { Card } from "@/frontend/shared/ui/surface";
import { Tag, type TagTone } from "@/frontend/shared/ui/tag";
import type { AdminQuery } from "../lib/use-admin-query";

/** Page frame: breadcrumb, display-face title, optional lede and actions. */
export function AdminPage({
  breadcrumb,
  title,
  description,
  actions,
  children,
}: {
  breadcrumb?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {breadcrumb && <p className="text-p3 text-ink-muted">{breadcrumb}</p>}
          <h1 className="font-display text-[22px] leading-[34px]">{title}</h1>
          {description && <p className="mt-0.5 text-p2 text-ink-muted">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Shows the first load, errors (with retry) and then the data. */
export function QueryBoundary<T>({ query, children }: { query: AdminQuery<T>; children: (data: T) => ReactNode }) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.error) {
    return (
      <Card className="max-w-[560px]" role="alert">
        <p className="text-p1 font-bold">We couldn’t load this.</p>
        <p className="mt-0.5 text-p2 text-ink-muted">{query.error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={query.reload}>
          Try again
        </Button>
      </Card>
    );
  }
  return (
    <div className="animate-pulse space-y-3" role="status" aria-label="Loading">
      <div className="h-24 rounded-card bg-ink-wash/60" />
      <div className="h-64 rounded-card bg-ink-wash/60" />
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="flex-[1_1_200px]">
      <p className="eyebrow">{label}</p>
      <p className="font-display text-[28px] leading-[44px]">{value}</p>
      {hint && <p className="text-p3 text-ink-muted">{hint}</p>}
    </Card>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="font-display text-[15px] leading-[26px]">{children}</h2>
      {action}
    </div>
  );
}

/** Label / value line used in detail cards. */
export function DetailRow({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 ${last ? "" : "border-b border-border-subtle"}`}>
      <span className="text-p2 text-ink-muted">{label}</span>
      <span className="text-right text-p2 font-bold">{children}</span>
    </div>
  );
}

export function Notice({ tone = "ok", children }: { tone?: "ok" | "error"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl px-3 py-2 text-p2 ${tone === "error" ? "bg-danger-wash text-danger-ink" : "bg-success-wash text-success-text"}`}
    >
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="px-3 py-8 text-center text-p2 text-ink-muted">{children}</p>;
}

/** Prev / Next with "Showing 1–20 of 128". */
export function Pagination({
  offset,
  pageSize,
  total,
  shown,
  onChange,
}: {
  offset: number;
  pageSize: number;
  total: number;
  shown: number;
  onChange: (offset: number) => void;
}) {
  const from = total === 0 ? 0 : offset + 1;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-p3 text-ink-muted">
        Showing {from}–{offset + shown} of {total}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - pageSize))}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={offset + shown >= total} onClick={() => onChange(offset + pageSize)}>
          Next
        </Button>
      </div>
    </div>
  );
}

const STATE_TONE: Record<string, { tone: TagTone; label: string }> = {
  live: { tone: "ok", label: "Live" },
  hidden: { tone: "notice", label: "Hidden" },
  closed: { tone: "neutral", label: "Closed" },
  expired: { tone: "neutral", label: "Expired" },
  removed: { tone: "high", label: "Removed" },
};

export function ReportStateTag({ state, hiddenBy }: { state: string; hiddenBy?: string | null }) {
  const { tone, label } = STATE_TONE[state] ?? { tone: "neutral" as const, label: state };
  return (
    <span className="inline-flex items-center gap-1.5">
      <Tag tone={tone}>{label}</Tag>
      {state === "hidden" && hiddenBy && <span className="text-p3 text-ink-muted">{hiddenBy}</span>}
    </span>
  );
}

/** Destructive buttons ask twice: the first click arms it, the second does it. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  size = "lg",
  block,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  block?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <Button
      variant="danger"
      size={size}
      block={block}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}

/** Modal that asks for a written reason (every moderation action is audited with one). Mount it to open it. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  pending: boolean;
  error: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const valid = reason.trim().length >= 3;
  return (
    <dialog
      ref={ref}
      aria-labelledby="reason-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-sheet p-5 text-ink backdrop:bg-scrim"
    >
      <h2 id="reason-title" className="font-display text-lg leading-8">
        {title}
      </h2>
      {description && <p className="mt-1 text-p2 text-ink-muted">{description}</p>}
      <label htmlFor="reason-text" className="mt-3 block text-p2 font-bold">
        Reason (required)
      </label>
      <Textarea id="reason-text" className="mt-1" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && (
        <p className="mt-2 text-p2 text-danger-ink" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={!valid || pending} onClick={() => onConfirm(reason.trim())}>
          {pending ? "Saving…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
