import type { Metadata } from "next";
import { AdminShell } from "@/frontend/features/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · NearPaw Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
