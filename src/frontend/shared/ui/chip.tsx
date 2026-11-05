import Link from "next/link";
import type { ComponentProps } from "react";

type ChipStyle = { on?: boolean; compact?: boolean };

/** Pill filter / option. `on` = selected (ink fill). `compact` is the 36px admin size. */
export function chipClass({ on = false, compact = false }: ChipStyle = {}, className = "") {
  return `inline-flex items-center justify-center gap-1.5 rounded-full border px-4 text-p2 font-semibold no-underline ${
    compact ? "min-h-9" : "min-h-10"
  } ${on ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink hover:bg-muted"} ${className}`;
}

export function ChipLink({ on, compact, className = "", ...props }: ComponentProps<typeof Link> & ChipStyle) {
  return <Link className={chipClass({ on, compact }, className)} aria-current={on ? "true" : undefined} {...props} />;
}

export function ChipButton({
  on,
  compact,
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & ChipStyle) {
  return <button type={type} className={chipClass({ on, compact }, `cursor-pointer ${className}`)} aria-pressed={on} {...props} />;
}
