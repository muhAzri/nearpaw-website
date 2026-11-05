import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/frontend/shared/ui/button";
import { Icon } from "@/frontend/shared/ui/icon";
import { PageContainer, SiteShell } from "@/frontend/shared/ui/site/site-shell";
import { Card, EmergencyNote, PageTitle } from "@/frontend/shared/ui/surface";

const FAQ: { question: string; answer: ReactNode }[] = [
  {
    question: "What is Nearpaw?",
    answer: "A map where people share animals they have seen that may need help, so others nearby can find them.",
  },
  {
    question: "Is this a rescue service?",
    answer:
      "No. Nearpaw cannot send anyone. For urgent danger, contact local animal control or emergency services.",
  },
  {
    question: "What happens after I submit a report?",
    answer:
      "It goes live on the map right away, showing the exact pin you set. Other people can add community updates or flag it. Reports leave the map automatically after a few days, and you can close yours at any time.",
  },
  {
    question: "Why was a report hidden?",
    answer: (
      <>
        A report is hidden when enough people flag it, or when our team finds it breaks the{" "}
        <Link href="/guidelines" className="font-bold text-ink underline">
          Community Guidelines
        </Link>
        , for example because it shows personal information. If you think it was a mistake, contact support with the report
        reference.
      </>
    ),
  },
  {
    question: "Why do reports show an exact location?",
    answer:
      "So anyone nearby can find the animal quickly. The pin is where the animal was seen. Your name and contact details are never shown, and photos have their metadata removed.",
  },
  {
    question: "How do alerts work?",
    answer:
      "In the app, choose an area, a radius and the animals you care about. We send a notification when a report is published there, nothing more.",
  },
  {
    question: "How do I delete my account?",
    answer: (
      <>
        In the app, go to Profile → Account → Delete account. You can keep your live reports anonymously or delete them.
        Can’t open the app? Use{" "}
        <Link href="/privacy-requests" className="font-bold text-ink underline">
          Data &amp; privacy requests
        </Link>
        .
      </>
    ),
  },
  {
    question: "Wildlife safety",
    answer: "Keep your distance. Never handle or feed wild animals. Contact local wildlife authorities.",
  },
];

export function HelpView() {
  return (
    <SiteShell current="help">
      <PageContainer>
        <PageTitle>Help</PageTitle>
        <p className="mt-1 text-p1 text-ink-muted">Quick answers about Nearpaw.</p>

        <div className="mt-5 max-w-[760px]">
          <EmergencyNote />
          <div className="mt-3">
            {FAQ.map((item) => (
              <details key={item.question} className="group border-b border-border py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-p1 font-bold [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <Icon name="chevronDown" className="transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-1.5 text-p1 text-ink-muted">{item.answer}</p>
              </details>
            ))}
          </div>
          <Card className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-p1 font-bold">Still need help?</p>
              <p className="text-p3 text-ink-muted">We reply within 3 business days.</p>
            </div>
            <ButtonLink href="/support" size="sm">
              Contact support
            </ButtonLink>
          </Card>
        </div>
      </PageContainer>
    </SiteShell>
  );
}
