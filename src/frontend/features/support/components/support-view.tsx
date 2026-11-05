import Link from "next/link";
import { SUPPORT_EMAIL } from "@/frontend/shared/lib/site";
import { PageContainer, SiteShell } from "@/frontend/shared/ui/site/site-shell";
import { Card, EmergencyNote, PageTitle } from "@/frontend/shared/ui/surface";
import { CopyEmailButton } from "./copy-email-button";
import { PrivacyRequestForm } from "./privacy-request-form";
import { SupportForm } from "./support-form";

export function SupportView() {
  return (
    <SiteShell current="support">
      <PageContainer>
        <div className="flex flex-wrap gap-10">
          <div className="max-w-[620px] flex-[1_1_520px]">
            <PageTitle>Support</PageTitle>
            <p className="mt-1 text-p1 text-ink-muted">Questions, bugs or a report that shouldn’t be there? Tell us.</p>
            <SupportForm />
          </div>
          <aside className="max-w-[360px] flex-[1_1_300px]">
            <Card>
              <p className="eyebrow">Email us</p>
              <p className="mt-1 break-all text-p1 font-bold">{SUPPORT_EMAIL}</p>
              <div className="mt-2.5">
                <CopyEmailButton email={SUPPORT_EMAIL} />
              </div>
              <p className="mt-2.5 text-p3 text-ink-muted">First reply within 3 business days.</p>
            </Card>
            <EmergencyNote className="mt-4" />
            <div className="mt-4 flex flex-col gap-2 text-p2 font-bold">
              <Link href="/help" className="underline">
                Read the Help centre →
              </Link>
              <Link href="/privacy-requests" className="underline">
                Data &amp; privacy requests →
              </Link>
            </div>
          </aside>
        </div>
      </PageContainer>
    </SiteShell>
  );
}

export function PrivacyRequestsView() {
  return (
    <SiteShell>
      <PageContainer>
        <div className="flex flex-wrap gap-10">
          <div className="max-w-[620px] flex-[1_1_520px]">
            <PageTitle>Data &amp; privacy requests</PageTitle>
            <p className="mt-1 text-p1 text-ink-muted">Ask to see, correct or delete your data. You don’t need the app.</p>
            <PrivacyRequestForm />
          </div>
          <aside className="max-w-[340px] flex-[1_1_280px]">
            <Card>
              <p className="text-p1 font-bold">Signed in to the app?</p>
              <p className="mt-0.5 text-p2 text-ink-muted">
                You can delete your account in Profile → Account → Delete account.
              </p>
            </Card>
          </aside>
        </div>
      </PageContainer>
    </SiteShell>
  );
}
