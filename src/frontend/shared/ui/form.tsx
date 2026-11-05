import type { ComponentProps, ReactNode } from "react";
import { Icon } from "./icon";

export const fieldClass =
  "w-full rounded-xl border-[1.5px] border-border bg-surface px-3 py-3 text-p1 text-ink placeholder:text-icon focus:border-ink focus:outline-none disabled:opacity-60 aria-[invalid=true]:border-danger";

/** Label + control + optional hint / error. Pass the control's `id` as `htmlFor`. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="text-p2 font-bold">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="mt-1 text-p3 text-ink-muted">{hint}</p>}
      {error && (
        <p className="mt-1 text-p3 text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${fieldClass} ${className}`} {...props} />;
}

export function Textarea({ className = "", rows = 4, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={`${fieldClass} resize-y ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={`${fieldClass} cursor-pointer appearance-none pr-10 ${className}`} {...props}>
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
    </div>
  );
}

/** A filter dropdown that looks like a chip (used in admin toolbars). */
export function ChipSelect({
  label,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { label: string }) {
  return (
    <label className={`relative inline-flex ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        className="min-h-9 cursor-pointer appearance-none rounded-full border border-border bg-surface pl-4 pr-9 text-p2 font-semibold text-ink hover:bg-muted"
        {...props}
      >
        {children}
      </select>
      <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2" />
    </label>
  );
}

export function Checkbox({
  label,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-2.5 text-p2 ${className}`}>
      <input type="checkbox" className="size-[22px] shrink-0 cursor-pointer accent-ink" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Radio({
  label,
  className = "",
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-center gap-3 text-p2 ${className}`}>
      <input type="radio" className="size-[22px] shrink-0 cursor-pointer accent-ink" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** On/off switch. Always give it a visible or `aria-label` name. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        checked ? "bg-ink" : "bg-[#d9d9d9]"
      }`}
    >
      <span
        className={`absolute top-[3px] size-5 rounded-full bg-white transition-[left] ${checked ? "left-[21px]" : "left-[3px]"}`}
      />
    </button>
  );
}
