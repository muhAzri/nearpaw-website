import type { Metadata } from "next";
import { SupportView } from "@/frontend/features/support";

export const metadata: Metadata = { title: "Support", description: "Questions, bugs or a report that shouldn’t be there? Tell us." };

export default function SupportPage() {
  return <SupportView />;
}
