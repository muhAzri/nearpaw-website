import Link from "next/link";
import { SUPPORT_EMAIL } from "@/frontend/shared/lib/site";
import { ButtonLink } from "@/frontend/shared/ui/button";
import { PawMark } from "@/frontend/shared/ui/logo";
import { Breadcrumb, PageContainer, SiteShell } from "@/frontend/shared/ui/site/site-shell";
import { Note, PageTitle, SectionHeading } from "@/frontend/shared/ui/surface";

export function HowWeAllocateView() {
  return (
    <SiteShell current="impact">
      <PageContainer>
        <Breadcrumb>
          <Link href="/impact" className="underline">
            Impact
          </Link>{" "}
          / How we allocate
        </Breadcrumb>
        <PageTitle>How we allocate</PageTitle>
        <div className="max-w-[720px]">
          <Note className="mt-4">
            <span className="font-bold">Company allocations, not user donations.</span> Nothing you do in the app is a
            payment.
          </Note>
          <SectionHeading className="mt-7">How surplus is determined</SectionHeading>
          <p className="mt-1 text-p1">
            [Business-owned text, legally reviewed. Explain how surplus is calculated for each period.]
          </p>
          <SectionHeading className="mt-6">What gets allocated</SectionHeading>
          <p className="mt-1 text-p1">Not all advertising revenue is donated. [State the actual policy and share.]</p>
          <SectionHeading className="mt-6">How we verify</SectionHeading>
          <p className="mt-1 text-p1">
            [A record is published only after the transfer is confirmed and the evidence is checked and redacted.]
          </p>
          <SectionHeading className="mt-6">Questions</SectionHeading>
          <p className="mt-1 text-p1">
            Write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <ButtonLink href="/impact" size="sm" className="mt-6">
            See published allocations
          </ButtonLink>
        </div>
      </PageContainer>
    </SiteShell>
  );
}

export function AboutView() {
  return (
    <SiteShell>
      <PageContainer>
        <PageTitle>About Nearpaw</PageTitle>
        <div className="max-w-[720px]">
          <p className="mt-3 text-lead">
            Nearpaw helps neighbours notice animals that may need help, and helps the right person find them fast.
          </p>
          <SectionHeading className="mt-7">How it’s funded</SectionHeading>
          <p className="mt-1 text-p1">
            Nearpaw is free. It is funded by advertising shown in the list view. Ads never appear on the map, report pages
            or the reporting flow.{" "}
            <Link href="/impact/how-we-allocate" className="font-bold underline">
              How we allocate →
            </Link>
          </p>
          <SectionHeading className="mt-6">Who’s behind it</SectionHeading>
          <p className="mt-1 text-p1">Nearpaw is built and run by Lambda Interactive. [Short company description.]</p>
          <SectionHeading className="mt-6">Contact</SectionHeading>
          <p className="mt-1 text-p1">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </PageContainer>
    </SiteShell>
  );
}

export function NotFoundView() {
  return (
    <SiteShell>
      <PageContainer>
        <div className="py-[60px] text-center">
          <div className="mx-auto flex size-[120px] items-center justify-center rounded-full bg-brand-wash">
            <PawMark className="size-[72px]" />
          </div>
          <h1 className="mt-5 font-display text-4xl leading-[52px]">We can’t find that page</h1>
          <p className="mt-1 text-p1 text-ink-muted">It may have moved, or the link may be wrong.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <ButtonLink href="/" size="sm">
              Home
            </ButtonLink>
            <ButtonLink href="/help" size="sm" variant="outline">
              Help
            </ButtonLink>
            <ButtonLink href="/support" size="sm" variant="outline">
              Support
            </ButtonLink>
          </div>
        </div>
      </PageContainer>
    </SiteShell>
  );
}
