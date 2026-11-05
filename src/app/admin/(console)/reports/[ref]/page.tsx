import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportReviewView } from "@/frontend/features/admin";

// Behind a client-side sign-in: nothing here can be prerendered per page, so skip instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Report review" };

export default function AdminReportPage({ params }: PageProps<"/admin/reports/[ref]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-ink-wash/60" aria-hidden="true" />}>
      <ReviewLoader params={params} />
    </Suspense>
  );
}

// `params` is only known per request, so it is read inside Suspense.
async function ReviewLoader({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <ReportReviewView reference={ref} />;
}
