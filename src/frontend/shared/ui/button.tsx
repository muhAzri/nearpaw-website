import Link from "next/link";
import type { ComponentProps } from "react";

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  outline: "border-border-strong text-ink hover:bg-surface-raised",
  ghost: "text-ink-muted hover:bg-surface-raised hover:text-ink",
  danger: "bg-danger text-on-danger hover:opacity-88",
} as const;

const SIZES = {
  sm: "h-8 px-4 text-[13px]",
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-6 text-[15px]",
  /** Icon-only: pass an `aria-label`. */
  icon: "size-10 px-0",
  "icon-sm": "size-8 px-0",
} as const;

type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  block?: boolean;
};

function buttonClass({ variant = "primary", size = "md", block = false }: ButtonStyle, className: string) {
  return `inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent font-semibold leading-5 disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`;
}

/** Pill button. One `primary` action per screen or dialog. */
export function Button({
  variant,
  size,
  block,
  className = "",
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return <button className={buttonClass({ variant, size, block }, className)} {...props} />;
}

/** A link that looks like a `Button`. */
export function ButtonLink({
  variant,
  size,
  block,
  className = "",
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size, block }, className)} {...props} />;
}
