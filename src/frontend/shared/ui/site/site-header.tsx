import Link from "next/link";
import { APP_STORE_URL } from "@/frontend/shared/lib/site";
import { ButtonLink } from "../button";
import { Logo } from "../logo";

export type SiteSection = "impact" | "help" | "support";

const LINKS: { id: SiteSection; href: string; label: string }[] = [
  { id: "impact", href: "/impact", label: "Impact" },
  { id: "help", href: "/help", label: "Help" },
  { id: "support", href: "/support", label: "Support" },
];

/**
 * Top bar. `landing` is the roomier home-page version (adds "How it works"); `page` is the compact bar
 * used on every other public page.
 */
export function SiteHeader({ current, variant = "page" }: { current?: SiteSection; variant?: "landing" | "page" }) {
  const landing = variant === "landing";
  return (
    <header className="border-b border-border-subtle bg-surface">
      <div
        className={`mx-auto flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-6 ${
          landing ? "min-h-[72px] max-w-[1200px] justify-between" : "min-h-[68px] max-w-[1120px]"
        }`}
      >
        <Logo
          markClassName={landing ? "size-9" : "size-8"}
          textClassName={landing ? "text-[22px]" : "text-xl"}
        />
        <nav aria-label="Main" className={`flex flex-wrap items-center gap-x-5 gap-y-1 ${landing ? "" : "ml-auto"}`}>
          {landing && (
            <Link href="/#how" className="py-3 text-p1 font-semibold no-underline">
              How it works
            </Link>
          )}
          {LINKS.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={current === link.id ? "page" : undefined}
              className={`py-3 no-underline ${landing ? "text-p1" : "text-p2"} ${current === link.id ? "font-bold" : "font-semibold"}`}
            >
              {link.label}
            </Link>
          ))}
          <ButtonLink href={APP_STORE_URL} size={landing ? "md" : "sm"}>
            {landing ? "Get the app" : "App Store"}
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
