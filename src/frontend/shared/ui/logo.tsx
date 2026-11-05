import Link from "next/link";
import { SITE_NAME } from "@/frontend/shared/lib/site";

/** The map-pin badge carrying a paw. Teal is only a fill; the paw is always ink. */
export function PawMark({ className = "size-9", pin = "#14b8a6" }: { className?: string; pin?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d="M512 840C468 780 262 650 262 462a250 250 0 1 1 500 0C762 650 556 780 512 840z" fill={pin} />
      <g fill="#262626">
        <ellipse cx="512" cy="520" rx="96" ry="80" />
        <circle cx="384" cy="440" r="42" />
        <circle cx="454" cy="356" r="44" />
        <circle cx="570" cy="356" r="44" />
        <circle cx="640" cy="440" r="42" />
      </g>
    </svg>
  );
}

/** Mark + wordmark. The wordmark is always Mochiy Pop One. */
export function Logo({
  href = "/",
  markClassName = "size-8",
  textClassName = "text-xl",
  label = SITE_NAME,
}: {
  href?: string | null;
  markClassName?: string;
  textClassName?: string;
  label?: string;
}) {
  const content = (
    <>
      <PawMark className={markClassName} />
      <span className={`font-display ${textClassName}`}>{label}</span>
    </>
  );
  if (href === null) return <span className="flex items-center gap-2">{content}</span>;
  return (
    <Link href={href} className="flex items-center gap-2 no-underline" aria-label={`${label} home`}>
      {content}
    </Link>
  );
}
