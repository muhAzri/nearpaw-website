import type { Metadata } from "next";
import { AuditView } from "@/frontend/features/admin";

// Behind a client-side sign-in: nothing here can be prerendered per page, so skip instant-navigation validation.
export const instant = false;

export const metadata: Metadata = { title: "Audit log" };

export default function AdminAuditViewPage() {
  return <AuditView />;
}
