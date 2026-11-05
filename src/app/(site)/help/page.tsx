import type { Metadata } from "next";
import { HelpView } from "@/frontend/features/content";

export const metadata: Metadata = { title: "Help", description: "Quick answers about Nearpaw." };

export default function HelpPage() {
  return <HelpView />;
}
