"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { CreateSupportMessageSchema } from "@/contracts";
import { describeError, fieldErrorsFrom } from "@/frontend/shared/lib/api-errors";
import { optionsOf } from "@/frontend/shared/lib/labels";
import { Button } from "@/frontend/shared/ui/button";
import { Field, Input, Select, Textarea } from "@/frontend/shared/ui/form";
import { Icon } from "@/frontend/shared/ui/icon";
import { Card } from "@/frontend/shared/ui/surface";
import { sendSupportMessage } from "../api/support";
import { Honeypot } from "./honeypot";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; ref: string; days: number };

export function SupportForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();

    const parsed = CreateSupportMessageSchema.safeParse({
      topic: text("topic"),
      email: text("email"),
      message: text("message"),
      reportRef: text("reportRef").toUpperCase() || undefined,
      website: text("website"),
      language: "en",
    });
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(z.flattenError(parsed.error)));
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setStatus({ kind: "sending" });
    try {
      const receipt = await sendSupportMessage(parsed.data);
      setStatus({ kind: "sent", ref: receipt.ref, days: receipt.firstReplyWithinBusinessDays });
    } catch (error) {
      const described = describeError(error);
      setErrors(described.fields);
      setFormError(described.message);
      setStatus({ kind: "idle" });
    }
  }

  if (status.kind === "sent") {
    return (
      <Card className="mt-6 border-success" role="status">
        <p className="flex items-center gap-2 text-p1 font-bold">
          <Icon name="check" /> Message sent
        </p>
        <p className="mt-1 text-p2 text-ink-muted">
          Your reference is <b className="text-ink">{status.ref}</b>. We reply within {status.days} business days, to the
          email you gave.
        </p>
        <Button size="sm" variant="outline" className="mt-4" onClick={() => setStatus({ kind: "idle" })}>
          Send another message
        </Button>
      </Card>
    );
  }

  const sending = status.kind === "sending";
  return (
    <form onSubmit={onSubmit} noValidate className="relative mt-4 flex flex-col gap-3.5">
      <Honeypot />
      <Field label="Topic" htmlFor="topic" error={errors.topic}>
        <Select id="topic" name="topic" defaultValue="content_abuse" aria-invalid={!!errors.topic}>
          {optionsOf("supportTopic").map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Your email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={!!errors.email} />
      </Field>
      <Field label="Message" htmlFor="message" error={errors.message} hint="At least 10 characters.">
        <Textarea id="message" name="message" rows={5} placeholder="How can we help?" aria-invalid={!!errors.message} />
      </Field>
      <Field label="Report reference (optional)" htmlFor="reportRef" error={errors.reportRef}>
        <Input id="reportRef" name="reportRef" placeholder="RPT-XXXXXX" autoCapitalize="characters" aria-invalid={!!errors.reportRef} />
      </Field>
      {formError && (
        <p className="text-p2 text-danger-ink" role="alert">
          {formError}
        </p>
      )}
      <div>
        <Button type="submit" disabled={sending} className="w-full max-w-[280px]">
          {sending ? "Sending…" : "Send message"}
        </Button>
        <p className="mt-2 text-p3 text-ink-muted">Please don’t send passwords or payment details.</p>
      </div>
    </form>
  );
}
