import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatDate, formatMoney } from "@/frontend/shared/lib/format";
import { labelOf } from "@/frontend/shared/lib/labels";
import { Breadcrumb, PageContainer, SiteShell } from "@/frontend/shared/ui/site/site-shell";
import { Card, Note, PageTitle } from "@/frontend/shared/ui/surface";
import { Tag } from "@/frontend/shared/ui/tag";
import { getAllocation } from "../api/impact";

export function AllocationDetailView({ params }: { params: Promise<{ id: string }> }) {
  return (
    <SiteShell current="impact">
      <PageContainer>
        <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-muted" aria-hidden="true" />}>
          <AllocationContent params={params} />
        </Suspense>
      </PageContainer>
    </SiteShell>
  );
}

async function AllocationContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const allocation = await getAllocation(id);
  if (!allocation) notFound();

  const rows: [string, string][] = [
    ["Category", labelOf("category", allocation.category)],
    ["Amount", formatMoney(allocation.amount, allocation.currency)],
    ["Transfer date", formatDate(allocation.transferDate)],
    ["Period", allocation.periodLabel ?? "—"],
  ];

  return (
    <>
      <Breadcrumb>
        <Link href="/impact" className="underline">
          Impact
        </Link>{" "}
        / Allocation
      </Breadcrumb>
      <PageTitle>{allocation.beneficiary}</PageTitle>
      <div className="mt-2 flex flex-wrap gap-2">
        <Tag tone="ok">Verified</Tag>
        <Tag>Company allocation</Tag>
      </div>

      <Card className="mt-6 max-w-[720px] !p-0">
        {rows.map(([name, value]) => (
          <div key={name} className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3.5 last:border-b-0">
            <span className="text-p2 text-ink-muted">{name}</span>
            <span className="text-p2 font-bold">{value}</span>
          </div>
        ))}
      </Card>

      {allocation.publicNote && (
        <div className="mt-6 max-w-[720px]">
          <h2 className="font-display text-xl leading-8">How the funds were used</h2>
          <p className="mt-1 text-p1">{allocation.publicNote}</p>
        </div>
      )}

      <Note className="mt-6 max-w-[720px]">
        {allocation.evidence.length > 0
          ? `${allocation.evidence.length} redacted evidence ${allocation.evidence.length === 1 ? "document is" : "documents are"} on file. `
          : ""}
        Evidence is checked and redacted before publishing and never shows private banking data. This is a company
        allocation, not a user donation.
      </Note>

      <Link href="/impact" className="mt-6 inline-block text-p2 font-bold underline">
        ← Back to impact
      </Link>
    </>
  );
}
