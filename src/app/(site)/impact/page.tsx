import type { Metadata } from "next";
import { ImpactView } from "@/frontend/features/impact";

export const metadata: Metadata = {
  title: "Impact",
  description: "Company allocations for animal welfare. Not user donations. Only verified records are published.",
};

export default function ImpactPage({ searchParams }: PageProps<"/impact">) {
  return <ImpactView searchParams={searchParams} />;
}
