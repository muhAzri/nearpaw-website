import type { Metadata } from "next";
import { AboutView } from "@/frontend/features/content";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return <AboutView />;
}
