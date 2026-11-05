import type { Metadata } from "next";
import { TermsView } from "@/frontend/features/content";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return <TermsView />;
}
