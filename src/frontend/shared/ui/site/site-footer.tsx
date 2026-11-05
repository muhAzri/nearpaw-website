import Link from "next/link";
import { COMPANY_NAME, COPYRIGHT_YEAR, EMERGENCY_NOTICE, SITE_NAME, SUPPORT_EMAIL } from "@/frontend/shared/lib/site";
import { CookieSettingsButton } from "./cookie-banner";

const LIGHT_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/support", label: "Support" },
  { href: "/about", label: "About" },
  { href: "/privacy-requests", label: "Data & privacy requests" },
];

const DARK_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/guidelines", label: "Community Guidelines" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/support", label: "Support" },
  { href: "/privacy-requests", label: "Data & Privacy Requests" },
];

/** `dark` is the landing page's closing band; `light` is used on every other page. */
export function SiteFooter({ variant = "light" }: { variant?: "light" | "dark" }) {
  if (variant === "dark") {
    return (
      <footer className="bg-ink text-white">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-10">
          <div className="flex flex-wrap justify-between gap-x-10 gap-y-6">
            <div className="max-w-[360px]">
              <span className="font-display text-xl">{SITE_NAME}</span>
              <p className="mt-2 text-p3 text-[#d9d9d9]">
                {EMERGENCY_NOTICE} For emergencies, contact local animal control or emergency services.
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-5 gap-y-1 text-p1 font-semibold">
              {DARK_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="py-3 no-underline">
                  {link.label}
                </Link>
              ))}
              <CookieSettingsButton className="py-3 font-semibold no-underline" />
            </nav>
          </div>
          <p className="mt-6 text-p3 text-[#d9d9d9]">
            © {COMPANY_NAME} · {SUPPORT_EMAIL}
          </p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-border-subtle bg-muted">
      <div className="mx-auto w-full max-w-[1120px] px-6 py-6">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-p3">
          {LIGHT_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="underline">
              {link.label}
            </Link>
          ))}
          <CookieSettingsButton />
        </nav>
        <p className="mt-2.5 text-p3 text-ink-muted">
          {EMERGENCY_NOTICE} © {COPYRIGHT_YEAR} {COMPANY_NAME}.
        </p>
      </div>
    </footer>
  );
}
