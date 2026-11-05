import Link from "next/link";
import { SITE_NAME } from "@/frontend/shared/lib/site";

const NAV = [
  { href: "/admin", label: "Overview" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-border bg-surface-raised p-4">
        <p className="mb-6 px-2 text-sm font-bold tracking-tight">{SITE_NAME} Admin</p>
        <nav className="flex flex-col gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 text-ink-muted hover:bg-surface hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
