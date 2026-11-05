import Link from "next/link";
import { Suspense } from "react";
import { formatDate, formatMoney } from "@/frontend/shared/lib/format";
import { labelOf } from "@/frontend/shared/lib/labels";
import { ChipLink } from "@/frontend/shared/ui/chip";
import { PageContainer, SiteShell } from "@/frontend/shared/ui/site/site-shell";
import { DataTable, Td, Th } from "@/frontend/shared/ui/table";
import { Tag } from "@/frontend/shared/ui/tag";
import { Card, PageTitle } from "@/frontend/shared/ui/surface";
import { getImpactOverview, getImpactPeriod, type PublicAllocation } from "../api/impact";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Public impact page: company allocations to animal welfare. Static shell; figures stream in. */
export function ImpactView({ searchParams }: { searchParams: SearchParams }) {
  return (
    <SiteShell current="impact">
      <PageContainer>
        <PageTitle>Impact</PageTitle>
        <p className="mt-1 max-w-[640px] text-p1 text-ink-muted">
          Company allocations for animal welfare. These are not user donations. Only verified records are published.
        </p>
        <Suspense fallback={<ImpactSkeleton />}>
          <ImpactContent searchParams={searchParams} />
        </Suspense>
      </PageContainer>
    </SiteShell>
  );
}

function ImpactSkeleton() {
  return (
    <div className="mt-5 animate-pulse" aria-hidden="true">
      <div className="h-10 w-72 rounded-full bg-muted" />
      <div className="mt-5 flex gap-4">
        <div className="h-[116px] flex-1 rounded-card bg-muted" />
        <div className="h-[116px] flex-1 rounded-card bg-muted" />
        <div className="h-[116px] flex-1 rounded-card bg-muted" />
      </div>
      <div className="mt-6 h-48 rounded-card bg-muted" />
    </div>
  );
}

async function ImpactContent({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).period;
  const periodId = typeof raw === "string" && raw ? raw : undefined;

  const [overview, selected] = await Promise.all([getImpactOverview(), periodId ? getImpactPeriod(periodId) : null]);

  const periodLabel = selected?.label ?? "All time";
  const totals = selected?.totals ?? overview.totals;
  const allocations = selected?.allocations ?? overview.recent;
  const beneficiaries = selected
    ? new Set(selected.allocations.map((a) => a.beneficiary)).size
    : overview.beneficiaries;

  return (
    <>
      <nav aria-label="Period" className="mt-5 flex flex-wrap items-center gap-2">
        <ChipLink href="/impact" on={!selected}>
          All time
        </ChipLink>
        {overview.periods.map((p) => (
          <ChipLink key={p.id} href={`/impact?period=${encodeURIComponent(p.id)}`} on={selected?.id === p.id}>
            {p.label}
          </ChipLink>
        ))}
        <Link href="/impact/how-we-allocate" className="ml-3 text-p2 font-bold underline">
          How we allocate →
        </Link>
      </nav>

      {periodId && !selected && (
        <p className="mt-4 text-p2 text-ink-muted">That period isn’t published, so we’re showing all time instead.</p>
      )}
      {selected?.summary && <p className="mt-4 max-w-[720px] text-p1">{selected.summary}</p>}

      <div className="mt-5 flex flex-wrap gap-4">
        {totals.map((t) => (
          <Card key={t.currency} className="flex-[1_1_200px]">
            <p className="eyebrow">Total · {t.currency}</p>
            <p className="font-display text-[28px] leading-[44px]">{formatMoney(t.amount, t.currency)}</p>
            <p className="text-p3 text-ink-muted">{periodLabel}</p>
          </Card>
        ))}
        <Card className="flex-[1_1_200px]">
          <p className="eyebrow">Beneficiaries</p>
          <p className="font-display text-[28px] leading-[44px]">{beneficiaries}</p>
          <p className="text-p3 text-ink-muted">organisations</p>
        </Card>
      </div>

      {allocations.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="text-p1 font-bold">No allocations published yet.</p>
          <p className="mt-1 text-p2 text-ink-muted">We publish a record once the transfer is confirmed and checked.</p>
        </Card>
      ) : (
        <>
          <AllocationTable allocations={allocations} />
          <p className="mt-2.5 text-p3 text-ink-muted">
            {!selected && allocations.length >= 10 ? "Showing the most recent allocations. Pick a period for the full list. " : ""}
            Evidence is redacted and shows no private banking data.
          </p>
        </>
      )}
    </>
  );
}

function AllocationTable({ allocations }: { allocations: PublicAllocation[] }) {
  return (
    <DataTable className="mt-6">
      <thead>
        <tr>
          <Th>Beneficiary</Th>
          <Th>Category</Th>
          <Th>Transfer date</Th>
          <Th>Amount</Th>
          <Th>Status</Th>
          <Th>
            <span className="sr-only">Details</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {allocations.map((a) => (
          <tr key={a.id}>
            <Td className="font-bold">{a.beneficiary}</Td>
            <Td>{labelOf("category", a.category)}</Td>
            <Td>{formatDate(a.transferDate)}</Td>
            <Td>{formatMoney(a.amount, a.currency)}</Td>
            <Td>
              <Tag tone="ok">Verified</Tag>
            </Td>
            <Td>
              <Link href={`/impact/allocations/${a.id}`} className="font-bold underline">
                Details
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  );
}
