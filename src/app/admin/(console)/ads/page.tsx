import type { Metadata } from "next";
import { AdsView } from "@/frontend/features/admin";

// Behind a client-side sign-in: nothing here can be prerendered per page, so skip instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Ad placements" };

export default function AdminAdsViewPage() {
  return <AdsView />;
}
