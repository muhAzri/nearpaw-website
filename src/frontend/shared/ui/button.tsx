import Link from "next/link";
import type { ComponentProps } from "react";

const VARIANTS = {
  /** The one main action on a screen: ink. */
  primary: "border-transparent bg-ink text-white hover:bg-ink/90",
  soft: "border-transparent bg-muted text-ink hover:bg-ink-wash",
  outline: "border-border bg-surface text-ink hover:bg-muted",
  /** Teal fill with an ink label. Never teal text. */
  brand: "border-transparent bg-brand text-ink hover:brightness-95",
  danger: "border-danger bg-surface text-danger-ink hover:bg-danger-wash",
} as const;

const SIZES = {
  sm: "h-10 px-4 text-p2",
  md: "h-11 px-5 text-p1",
  lg: "h-[52px] px-7 text-p1",
} as const;

type ButtonStyle = {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  block?: boolean;
};

export function buttonClass({ variant = "primary", size = "lg", block = false }: ButtonStyle = {}, className = "") {
  return `inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border font-bold no-underline disabled:cursor-not-allowed disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`;
}

/** Pill button. One `primary` action per screen or dialog. */
export function Button({
  variant,
  size,
  block,
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyle) {
  return <button type={type} className={buttonClass({ variant, size, block }, className)} {...props} />;
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
