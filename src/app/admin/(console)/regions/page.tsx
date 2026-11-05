import type { Metadata } from "next";
import { RegionsView } from "@/frontend/features/admin";

// Behind a client-side sign-in: nothing here can be prerendered per page, so skip instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Regions & config" };

export default function AdminRegionsViewPage() {
  return <RegionsView />;
}
