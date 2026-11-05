import type { Metadata } from "next";
import { SharedReportView } from "@/frontend/features/shared-report";

// A shared report is a doorway into the app, not content to index.
export const metadata: Metadata = { title: "Shared report", robots: { index: false, follow: false } };

export default function SharedReportPage({ params }: PageProps<"/r/[ref]">) {
  return <SharedReportView params={params} />;
}
