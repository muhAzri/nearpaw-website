import type { ReactNode } from "react";
import type { z } from "zod";
import type { UrgencySchema } from "@/contracts";
import { Icon } from "./icon";

const TONES = {
  neutral: "bg-ink-wash text-ink",
  high: "bg-danger-wash text-danger-text",
  medium: "bg-warn-wash text-warn-text",
  ok: "bg-success-wash text-success-text",
  /** Safety / freshness notices. */
  notice: "border border-border bg-notice text-ink",
} as const;

export type TagTone = keyof typeof TONES;
type Urgency = z.infer<typeof UrgencySchema>;

/** Small status label. Colour is never the only cue: always carries words. */
export function Tag({ tone = "neutral", children, className = "" }: { tone?: TagTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-p3 font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const URGENCY: Record<Urgency, { tone: TagTone; label: string }> = {
  high: { tone: "high", label: "High" },
  medium: { tone: "medium", label: "Medium" },
  low: { tone: "neutral", label: "Low" },
};

/** Urgency is carried by colour, a marker ("!" for high) and the written label. */
export function UrgencyTag({ urgency, suffix = "" }: { urgency: Urgency; suffix?: string }) {
  const { tone, label } = URGENCY[urgency];
  return (
    <Tag tone={tone}>
      {urgency === "high" && <Icon name="alert" className="size-3" />}
      {label}
      {suffix}
    </Tag>
  );
}
