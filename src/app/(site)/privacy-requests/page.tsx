import type { Metadata } from "next";
import { PrivacyRequestsView } from "@/frontend/features/support";

export const metadata: Metadata = { title: "Data & privacy requests" };

export default function PrivacyRequestsPage() {
  return <PrivacyRequestsView />;
}
