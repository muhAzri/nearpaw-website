import type { Metadata } from "next";
import { HowWeAllocateView } from "@/frontend/features/content";

export const metadata: Metadata = { title: "How we allocate" };

export default function HowWeAllocatePage() {
  return <HowWeAllocateView />;
}
