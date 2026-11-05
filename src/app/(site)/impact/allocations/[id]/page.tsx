import type { Metadata } from "next";
import { AllocationDetailView } from "@/frontend/features/impact";

export const metadata: Metadata = { title: "Allocation" };

export default function AllocationPage({ params }: PageProps<"/impact/allocations/[id]">) {
  return <AllocationDetailView params={params} />;
}
