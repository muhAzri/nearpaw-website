"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AllocationInputSchema } from "@/contracts";
import { fieldErrorsFrom } from "@/frontend/shared/lib/api-errors";
import { formatDate } from "@/frontend/shared/lib/format";
import { optionsOf } from "@/frontend/shared/lib/labels";
import { Button } from "@/frontend/shared/ui/button";
import { ChipButton } from "@/frontend/shared/ui/chip";
import { Checkbox, Field, Input, Select, Textarea } from "@/frontend/shared/ui/form";
import { Icon } from "@/frontend/shared/ui/icon";
import { Card } from "@/frontend/shared/ui/surface";
import { Tag, type TagTone } from "@/frontend/shared/ui/tag";
import { adminApi } from "../api/admin-api";
import type { Allocation, PeriodRow } from "../api/schemas";
import { useAction } from "../lib/use-action";
import { useAdminQuery } from "../lib/use-admin-query";
import { AdminPage, Notice, QueryBoundary, SectionTitle } from "./admin-ui";

const STAGES = ["draft", "verified", "published"] as const;
const STAGE_TONE: Record<string, TagTone> = { draft: "neutral", verified: "medium", published: "ok" };

export function ImpactAdminView() {
  const periods = useAdminQuery("impact-periods", adminApi.periods);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <AdminPage breadcrumb="Admin / Impact" title="Impact">
      <QueryBoundary query={periods}>
        {(list) => {
          const period = list.find((p) => p.id === selected) ?? list[0];
          return (
            <div className="flex flex-wrap items-start gap-4">
              <Card className="min-w-0 flex-[1_1_280px]">
                <SectionTitle
                  action={
                    <Button size="sm" onClick={() => setCreating((c) => !c)} aria-expanded={creating}>
                      New period
                    </Button>
                  }
                >
                  Periods
                </SectionTitle>
                {creating && (
                  <NewPeriodForm
                    onCreated={(id) => {
                      setCreating(false);
                      setSelected(id);
                      periods.reload();
                    }}
                  />
                )}
                {list.length === 0 && !creating && (
                  <p className="py-4 text-p2 text-ink-muted">No periods yet. Create one to start recording allocations.</p>
                )}
                <ul>
                  {list.map((p) => (
                    <li key={p.id} className="border-b border-border-subtle last:border-b-0">
                      <button
                        type="button"
                        aria-pressed={p.id === period?.id}
                        onClick={() => setSelected(p.id)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-3 text-left ${p.id === period?.id ? "bg-muted" : "hover:bg-muted/60"}`}
                      >
                        <span className="flex-1">
                          <span className="block text-p2 font-bold">{p.label}</span>
                          <span className="block text-p3 text-ink-muted">
                            {p.allocations} {p.allocations === 1 ? "allocation" : "allocations"}
                          </span>
                        </span>
                        <Tag tone={p.status === "published" ? "ok" : "neutral"}>{p.status === "published" ? "Published" : "Draft"}</Tag>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>

              {period && <PeriodEditor key={period.id} period={period} onPeriodChanged={periods.reload} />}
            </div>
          );
        }}
      </QueryBoundary>
    </AdminPage>
  );
}

function NewPeriodForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [label, setLabel] = useState("");
  const [summary, setSummary] = useState("");
  const action = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const created = await action.run(() => adminApi.createPeriod({ label: label.trim(), summary: summary.trim() }));
    if (created) onCreated(created.id);
  }

  return (
    <form onSubmit={submit} className="mb-3 rounded-xl bg-muted p-3">
      <Field label="Label" htmlFor="period-label">
        <Input id="period-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Q4 2026" maxLength={40} required />
      </Field>
      <Field label="Public summary (optional)" htmlFor="period-summary" className="mt-2">
        <Textarea id="period-summary" rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
      </Field>
      {action.error && <p className="mt-2 text-p3 text-danger-ink" role="alert">{action.error}</p>}
      <Button type="submit" size="sm" className="mt-3" disabled={label.trim().length < 2 || action.pending}>
        {action.pending ? "Creating…" : "Create period"}
      </Button>
    </form>
  );
}

function PeriodEditor({ period, onPeriodChanged }: { period: PeriodRow; onPeriodChanged: () => void }) {
  const allocations = useAdminQuery(`allocations:${period.id}`, () => adminApi.allocations(period.id));
  const [choice, setChoice] = useState<string | "new" | null>(null);
  const toggle = useAction();
  const published = period.status === "published";

  async function togglePublished() {
    const result = await toggle.run(() => adminApi.updatePeriod(period.id, { published: !published }));
    if (result) onPeriodChanged();
  }

  return (
    <Card className="min-w-0 flex-[2_1_560px]">
      <SectionTitle
        action={
          <Button size="sm" variant="outline" disabled={toggle.pending} onClick={togglePublished}>
            {published ? "Unpublish period" : "Publish period"}
          </Button>
        }
      >
        Allocation · {period.label}
      </SectionTitle>
      <p className="text-p3 text-ink-muted">
        {published
          ? "This period is public. An allocation shows up on the website once it is published too."
          : "This period is a draft, so nothing in it is public yet, even published allocations."}
      </p>
      {toggle.error && (
        <div className="mt-2">
          <Notice tone="error">{toggle.error}</Notice>
        </div>
      )}

      <QueryBoundary query={allocations}>
        {(list) => {
          const current = choice === "new" ? null : choice ? (list.find((a) => a.id === choice) ?? null) : (list[0] ?? null);
          const isNew = !current;
          return (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {list.map((a) => (
                  <ChipButton key={a.id} compact on={!isNew && current?.id === a.id} onClick={() => setChoice(a.id)}>
                    {a.beneficiary}
                  </ChipButton>
                ))}
                <ChipButton compact on={isNew} onClick={() => setChoice("new")}>
                  + New allocation
                </ChipButton>
              </div>
              <AllocationForm
                key={isNew ? "new" : current?.id}
                period={period}
                allocation={isNew ? null : current}
                onSaved={(id) => {
                  setChoice(id);
                  allocations.reload();
                  onPeriodChanged();
                }}
              />
            </>
          );
        }}
      </QueryBoundary>
    </Card>
  );
}

interface FormState {
  beneficiary: string;
  category: string;
  amount: string;
  currency: string;
  transferDate: string;
  transferConfirmed: boolean;
  publicNote: string;
  evidence: string[];
  redactionChecked: boolean;
}

const fromAllocation = (a: Allocation | null): FormState => ({
  beneficiary: a?.beneficiary ?? "",
  category: a?.category ?? "shelter",
  amount: a ? String(a.amount) : "",
  currency: a?.currency ?? "IDR",
  transferDate: a ? a.transferDate.slice(0, 10) : "",
  transferConfirmed: a?.transferConfirmed ?? false,
  publicNote: a?.publicNote ?? "",
  evidence: a?.evidence ?? [],
  redactionChecked: a?.redactionChecked ?? false,
});

function AllocationForm({
  period,
  allocation,
  onSaved,
}: {
  period: PeriodRow;
  allocation: Allocation | null;
  onSaved: (id: string) => void;
}) {
  const [initial, setInitial] = useState(() => fromAllocation(allocation));
  const [form, setForm] = useState(initial);
  const [evidenceKey, setEvidenceKey] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const action = useAction();

  const locked = allocation?.status === "published";
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDone(null);
  };

  async function save() {
    const parsed = AllocationInputSchema.safeParse({
      beneficiary: form.beneficiary,
      category: form.category,
      amount: Number(form.amount),
      currency: form.currency.trim().toUpperCase(),
      transferDate: form.transferDate,
      publicNote: form.publicNote,
      evidence: form.evidence,
      redactionChecked: form.redactionChecked,
    });
    if (!parsed.success || !form.transferDate) {
      const fields = parsed.success ? {} : fieldErrorsFrom(z.flattenError(parsed.error));
      if (!form.transferDate) fields.transferDate = "Pick the transfer date";
      setErrors(fields);
      return;
    }
    setErrors({});
    const saved = await action.run(async () => {
      if (allocation) {
        return adminApi.updateAllocation(allocation.id, { ...parsed.data, transferConfirmed: form.transferConfirmed });
      }
      const created = await adminApi.createAllocation(period.id, parsed.data);
      // Always send every field on PATCH: the backend fills omitted fields with their defaults (evidence, note…),
      // so a partial body would wipe them.
      return form.transferConfirmed
        ? adminApi.updateAllocation(created.id, { ...parsed.data, transferConfirmed: true })
        : created;
    });
    if (saved) {
      setInitial(form);
      setDone("Saved as draft.");
      onSaved(saved.id);
    }
  }

  async function stage(to: "draft" | "verified" | "published") {
    if (!allocation) return;
    const result = await action.run(() => adminApi.stageAllocation(allocation.id, to));
    if (result) {
      setDone(to === "published" ? "Published. It’s now on the public Impact page." : to === "verified" ? "Marked verified." : "Back to draft.");
      onSaved(result.id);
    }
  }

  function addEvidence() {
    const key = evidenceKey.trim();
    if (!/^evidence\/[A-Za-z0-9/_.-]{1,180}$/.test(key)) {
      setErrors((e) => ({ ...e, evidence: "Use a storage key like evidence/q4-receipt.pdf" }));
      return;
    }
    setErrors((e) => ({ ...e, evidence: "" }));
    set("evidence", [...form.evidence, key]);
    setEvidenceKey("");
  }

  const status = allocation?.status ?? "draft";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="mt-4"
    >
      {allocation && (
        <div className="mb-3 flex items-center gap-1.5" aria-label={`Status: ${status}`}>
          {STAGES.map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && <Icon name="chevronRight" className="size-3.5 text-icon" />}
              <Tag tone={s === status ? STAGE_TONE[s] : "neutral"} className={s === status ? "" : "opacity-60"}>
                {s === status && <Icon name="check" className="size-3" />}
                {s[0].toUpperCase() + s.slice(1)}
              </Tag>
            </span>
          ))}
        </div>
      )}
      {locked && <Notice tone="error">Published records are locked. Unpublish this allocation to edit it.</Notice>}

      <fieldset disabled={locked} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Beneficiary" htmlFor="alloc-beneficiary" error={errors.beneficiary}>
          <Input id="alloc-beneficiary" value={form.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} placeholder="Organisation name" />
        </Field>
        <Field label="Category" htmlFor="alloc-category">
          <Select id="alloc-category" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {optionsOf("category").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount" htmlFor="alloc-amount" error={errors.amount}>
          <Input id="alloc-amount" type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
        </Field>
        <Field label="Currency" htmlFor="alloc-currency" error={errors.currency} hint="3-letter code, e.g. IDR or USD.">
          <Input id="alloc-currency" value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
        </Field>
        <Field label="Transfer date" htmlFor="alloc-date" error={errors.transferDate}>
          <Input id="alloc-date" type="date" value={form.transferDate} onChange={(e) => set("transferDate", e.target.value)} />
        </Field>
        <div className="flex items-end pb-3">
          <Checkbox
            label="Transfer confirmed"
            checked={form.transferConfirmed}
            onChange={(e) => set("transferConfirmed", e.target.checked)}
          />
        </div>
      </fieldset>

      <fieldset disabled={locked}>
        <Field label="Public note" htmlFor="alloc-note" className="mt-3" error={errors.publicNote}>
          <Textarea id="alloc-note" rows={3} value={form.publicNote} onChange={(e) => set("publicNote", e.target.value)} placeholder="How the funds were used" />
        </Field>

        <div className="mt-3">
          <p className="text-p2 font-bold">Evidence</p>
          <div className="mt-1 rounded-xl border-2 border-dashed border-border p-4">
            {form.evidence.length === 0 && <p className="text-p2 text-ink-muted">No redacted files attached yet.</p>}
            <ul>
              {form.evidence.map((key) => (
                <li key={key} className="flex items-center gap-3 py-1">
                  <Icon name="doc" />
                  <span className="min-w-0 flex-1 break-all text-p2">{key}</span>
                  <button
                    type="button"
                    className="cursor-pointer text-p3 font-bold underline"
                    onClick={() => set("evidence", form.evidence.filter((k) => k !== key))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input
                aria-label="Evidence storage key"
                value={evidenceKey}
                onChange={(e) => setEvidenceKey(e.target.value)}
                placeholder="evidence/receipt.pdf"
                className="min-w-0 flex-1 !py-2"
              />
              <Button size="sm" variant="outline" onClick={addEvidence}>
                Attach
              </Button>
            </div>
            {errors.evidence && <p className="mt-1 text-p3 text-danger-ink">{errors.evidence}</p>}
            <p className="mt-2 text-p3 text-ink-muted">
              File upload isn’t connected yet. Attach the storage key of a redacted file. Never use private banking details.
            </p>
          </div>
          <Checkbox
            className="mt-3"
            label="Evidence checked: no private details shown"
            checked={form.redactionChecked}
            onChange={(e) => set("redactionChecked", e.target.checked)}
          />
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={locked || action.pending || (!!allocation && !dirty)}>
          Save draft
        </Button>
        {period.status === "published" ? (
          <Link
            href={`/impact?period=${encodeURIComponent(period.id)}`}
            target="_blank"
            className="inline-flex h-10 items-center rounded-full border border-border px-4 text-p2 font-bold no-underline hover:bg-muted"
          >
            Preview public view
          </Link>
        ) : (
          <Button size="sm" variant="outline" disabled title="Publish the period to preview it">
            Preview public view
          </Button>
        )}
        <Button size="sm" disabled={!allocation || dirty || status !== "draft" || action.pending} onClick={() => stage("verified")}>
          Verify
        </Button>
        <Button
          size="sm"
          variant="brand"
          disabled={!allocation || dirty || status !== "verified" || action.pending}
          onClick={() => stage("published")}
        >
          Publish
        </Button>
        {locked && (
          <Button size="sm" variant="outline" disabled={action.pending} onClick={() => stage("draft")}>
            Unpublish
          </Button>
        )}
      </div>
      <p className="mt-2 text-p3 text-ink-muted">
        Publishing needs a verified, transfer-confirmed record with checked evidence.{" "}
        {allocation && dirty ? "Save your changes before verifying." : ""}
        {allocation?.publishedAt ? ` Published ${formatDate(allocation.publishedAt)}.` : ""}
      </p>
      <div className="mt-2 space-y-2" aria-live="polite">
        {action.error && <Notice tone="error">{action.error}</Notice>}
        {done && !action.error && <Notice>{done}</Notice>}
      </div>
    </form>
  );
}
