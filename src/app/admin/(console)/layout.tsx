import { Suspense } from "react";
import { AdminLoading, AdminShell } from "@/frontend/features/admin";

// The shell reads the current path, which is only known per request, so it streams in behind a fallback.
export default function ConsoleLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
