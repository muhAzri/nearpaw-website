import type { Metadata } from "next";
import { GuidelinesView } from "@/frontend/features/content";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function GuidelinesPage() {
  return <GuidelinesView />;
}
