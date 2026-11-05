import Link from "next/link";
import { Suspense } from "react";
import { APP_STORE_URL } from "@/frontend/shared/lib/site";
import { ButtonLink } from "@/frontend/shared/ui/button";
import { SiteFooter } from "@/frontend/shared/ui/site/site-footer";
import { SiteHeader } from "@/frontend/shared/ui/site/site-header";
import { EmergencyNote } from "@/frontend/shared/ui/surface";
import { Coverage } from "./coverage";
import { PhoneMock } from "./phone-mock";

const STEPS = [
  {
    title: "See reports near you",
    body: "Open the map and tap a badge to read the story, see how recent it is, and read community updates.",
  },
  {
    title: "Report an animal",
    body: "Add a photo, drop a pin, describe what you saw. It appears on the map right away.",
  },
  {
    title: "Get calm alerts",
    body: "Choose an area and radius. We notify you when a report is published there — nothing more.",
  },
];

export function LandingView() {
  return (
    <div className="bg-surface">
      <SiteHeader variant="landing" />

      <main>
        <section className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-12 px-6 py-16">
          <div className="min-w-0 flex-[1_1_480px]">
            <p className="eyebrow">Community awareness for animals in need</p>
            <h1 className="mt-2 font-display text-5xl leading-[62px]">See animals in need, right where you are.</h1>
            <p className="mt-4 max-w-[520px] text-lead text-ink-muted">
              Nearpaw puts reports from your neighborhood on a map. Share what you find, see what others have shared, and
              get calm alerts for the area you choose.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href={APP_STORE_URL}>Download on the App Store</ButtonLink>
              <ButtonLink href="#how" variant="soft">
                How it works
              </ButtonLink>
            </div>
            <EmergencyNote className="mt-7 max-w-[520px]" />
          </div>
          <div className="flex flex-[1_1_320px] justify-center">
            <PhoneMock />
          </div>
        </section>

        <section id="how" className="scroll-mt-4 border-t-[5px] border-muted">
          <div className="mx-auto w-full max-w-[1200px] px-6 py-16">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-1 font-display text-3xl leading-[42px]">Three simple steps</h2>
            <ol className="mt-7 flex flex-wrap gap-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex-[1_1_280px] rounded-sheet bg-muted p-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-brand text-lead font-bold">
                    {i + 1}
                  </div>
                  <p className="mt-4 text-lead font-bold">{step.title}</p>
                  <p className="mt-1 text-p1 text-ink-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-muted">
          <div className="mx-auto flex w-full max-w-[1200px] flex-wrap gap-10 px-6 py-14">
            <div className="flex-[1_1_420px]">
              <p className="eyebrow">Built so help can find it</p>
              <h2 className="mt-1 font-display text-3xl leading-[42px]">The exact spot, not a guess</h2>
              <p className="mt-3 text-lead text-ink-muted">
                Every report shows the exact spot where the animal was seen, so anyone nearby can find it quickly. Your
                name and contact details are never shown.
              </p>
            </div>
            <div className="flex flex-[1_1_420px] flex-col gap-3">
              <div className="rounded-sheet bg-surface p-5">
                <p className="text-lead font-bold">Where we’re active</p>
                <p className="mt-1 text-p1 text-ink-muted">
                  <Suspense fallback="Browsing and reporting work wherever you are.">
                    <Coverage />
                  </Suspense>
                </p>
              </div>
              <div className="rounded-sheet bg-surface p-5">
                <p className="text-lead font-bold">Where advertising goes</p>
                <p className="mt-1 text-p1 text-ink-muted">
                  Nearpaw shows labelled ads in the list only — never on the map or while you report. We publish what we
                  allocate to animal-welfare groups, and how we decide.{" "}
                  <Link href="/impact/how-we-allocate" className="font-bold text-ink underline">
                    How we allocate
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter variant="dark" />
    </div>
  );
}
