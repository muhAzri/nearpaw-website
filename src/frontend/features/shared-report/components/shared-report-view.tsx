import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { formatRelativeTime } from "@/frontend/shared/lib/format";
import { APP_STORE_URL, appReportLink } from "@/frontend/shared/lib/site";
import { ButtonLink } from "@/frontend/shared/ui/button";
import { Icon } from "@/frontend/shared/ui/icon";
import { Logo } from "@/frontend/shared/ui/logo";
import { EmergencyNote, Note } from "@/frontend/shared/ui/surface";
import { Tag, type TagTone } from "@/frontend/shared/ui/tag";
import { getSharedReport } from "../api/shared-report";

const FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/support", label: "Support" },
];

/** Minimal chrome: this page is a doorway into the app, not part of the site. */
function Chrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex min-h-16 w-full max-w-[960px] items-center px-6">
          <Logo />
        </div>
      </header>
      <main className="flex flex-1 justify-center px-6 py-12">
        <div className="w-full max-w-[520px]">{children}</div>
      </main>
      <footer className="border-t border-border-subtle">
        <nav aria-label="Footer" className="mx-auto flex w-full max-w-[960px] flex-wrap gap-x-5 gap-y-2 px-6 py-4 text-p3">
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}

const URGENCY: Record<string, { tone: TagTone; label: string }> = {
  high: { tone: "high", label: "High urgency" },
  medium: { tone: "medium", label: "Medium urgency" },
  low: { tone: "neutral", label: "Low urgency" },
};

export function SharedReportView({ params }: { params: Promise<{ ref: string }> }) {
  return (
    <Chrome>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-sheet bg-muted" aria-hidden="true" />}>
        <SharedReportContent params={params} />
      </Suspense>
    </Chrome>
  );
}

async function SharedReportContent({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const report = await getSharedReport(ref);
  if (!report) notFound();

  const urgency = URGENCY[report.urgency];
  return (
    <>
      <div className="rounded-sheet border border-border p-6">
        <div className="flex flex-wrap gap-1.5">
          <Tag tone={urgency.tone}>
            {report.urgency === "high" && <Icon name="alert" className="size-3" />}
            {urgency.label} (reporter’s view)
          </Tag>
          <Tag>Published</Tag>
        </div>
        <h1 className="mt-3 font-display text-2xl leading-9">{report.title}</h1>
        <ul className="mt-3 flex flex-col gap-2 text-p1">
          {report.area && (
            <li className="flex items-center gap-2">
              <Icon name="pin" />
              Area: {report.area}
            </li>
          )}
          <li className="flex items-center gap-2">
            <Icon name="clock" />
            Posted {formatRelativeTime(report.createdAt)} — the situation may have changed.
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-3">
          <ButtonLink href={appReportLink(report.ref)} block>
            Open in the Nearpaw app
          </ButtonLink>
          <ButtonLink href={APP_STORE_URL} variant="soft" block>
            Get it on the App Store
          </ButtonLink>
        </div>
      </div>
      <Note className="mt-4">
        <span className="font-bold">Nearpaw is not an emergency or rescue service.</span> For urgent danger, contact local
        animal control or emergency services. The exact pin, photos and updates are in the app. The reporter’s details are
        never shared.
      </Note>
    </>
  );
}

/** Shown (with a 404 status) when the shared report is gone. */
export function SharedReportUnavailable() {
  return (
    <Chrome>
      <div className="rounded-sheet border border-border p-6 text-center">
        <h1 className="font-display text-2xl leading-9">This report is no longer available.</h1>
        <p className="mt-2 text-p1 text-ink-muted">It may have expired, or the person who shared it may have closed it.</p>
        <div className="mt-6 flex flex-col gap-3">
          <ButtonLink href={APP_STORE_URL} block>
            Get it on the App Store
          </ButtonLink>
          <ButtonLink href="/" variant="soft" block>
            About Nearpaw
          </ButtonLink>
        </div>
      </div>
      <EmergencyNote className="mt-4" />
    </Chrome>
  );
}
