import type { Metadata } from "next";
import { DisclaimerView } from "@/frontend/features/content";

export const metadata: Metadata = { title: "Disclaimer & Emergency Resources" };

export default function DisclaimerPage() {
  return <DisclaimerView />;
}
