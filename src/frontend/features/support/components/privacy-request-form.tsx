"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { CreatePrivacyRequestSchema } from "@/contracts";
import { describeError, fieldErrorsFrom } from "@/frontend/shared/lib/api-errors";
import { optionsOf } from "@/frontend/shared/lib/labels";
import { Button } from "@/frontend/shared/ui/button";
import { Field, Input, Textarea } from "@/frontend/shared/ui/form";
import { Card, Note } from "@/frontend/shared/ui/surface";
import { sendPrivacyRequest } from "../api/support";
import { Honeypot } from "./honeypot";

type Receipt = { ref: string } | null;

export function PrivacyRequestForm() {
  const [receipt, setReceipt] = useState<Receipt>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();

    const parsed = CreatePrivacyRequestSchema.safeParse({
      type: text("type"),
      email: text("email"),
      accountIdentifier: text("accountIdentifier") || undefined,
      details: text("details"),
      website: text("website"),
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(z.flattenError(parsed.error)));
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setSending(true);
    try {
      const result = await sendPrivacyRequest(parsed.data);
      setReceipt({ ref: result.ref });
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fields);
      setFormError(described.message);
    } finally {
      setSending(false);
    }
  }

  if (receipt) {
    return (
      <Card className="mt-6 border-success" role="status">
        <p className="text-p1 font-bold">Request received</p>
        <p className="mt-0.5 text-p2 text-ink-muted">
          Reference <b className="text-ink">{receipt.ref}</b>. We’ll email you at the address you gave, and aim to respond
          within 30 days.
        </p>
        <Button size="sm" variant="outline" className="mt-4" onClick={() => setReceipt(null)}>
          Send another request
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative mt-4 flex flex-col gap-3.5">
      <Honeypot />
      <fieldset>
        <legend className="text-p2 font-bold">Request type</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {optionsOf("privacyType").map((o, i) => (
            <label
              key={o.value}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-border bg-surface px-4 text-p2 font-semibold has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
            >
              <input type="radio" name="type" value={o.value} defaultChecked={i === 0} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        {errors.type && <p className="mt-1 text-p3 text-danger-ink">{errors.type}</p>}
      </fieldset>
      <Field label="Your email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} />
      </Field>
      <Field label="Account identifier (optional)" htmlFor="accountIdentifier" error={errors.accountIdentifier}>
        <Input id="accountIdentifier" name="accountIdentifier" placeholder="Account email or report reference" />
      </Field>
      <Field label="Details" htmlFor="details" error={errors.details}>
        <Textarea id="details" name="details" rows={4} placeholder="Tell us what you need." aria-invalid={!!errors.details} />
      </Field>
      <Note icon="lock">We verify your identity before sharing anything. We’ll only ask for what we need.</Note>
      {formError && (
        <p className="text-p2 text-danger-ink" role="alert">
          {formError}
        </p>
      )}
      <div>
        <Button type="submit" disabled={sending} className="w-full max-w-[280px]">
          {sending ? "Submitting…" : "Submit request"}
        </Button>
        <p className="mt-2 text-p3 text-ink-muted">We aim to respond within 30 days.</p>
      </div>
    </form>
  );
}
