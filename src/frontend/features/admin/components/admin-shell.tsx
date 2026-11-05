"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Logo } from "@/frontend/shared/ui/logo";
import { clearAdminSession, sessionEndedByExpiry, useAdminToken } from "../lib/session";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/updates", label: "Updates" },
  { href: "/admin/flags", label: "Flags" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/impact", label: "Impact" },
  { href: "/admin/regions", label: "Regions & config" },
  { href: "/admin/ads", label: "Ad placements" },
  { href: "/admin/support", label: "Support inbox" },
  { href: "/admin/audit", label: "Audit log" },
] as const;

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

/** Shown while the session is being checked (and as the Suspense fallback around the shell). */
export function AdminLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted" role="status">
      <span className="sr-only">Loading</span>
      <Logo href={null} markClassName="size-10" textClassName="text-xl" label="Nearpaw Admin" />
    </div>
  );
}

/** Sidebar + content. Everything inside needs a signed-in admin; signed-out visitors go to the sign-in page. */
export function AdminShell({ children }: { children: ReactNode }) {
  const token = useAdminToken();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (token === null) {
      const params = new URLSearchParams({ next: pathname });
      if (sessionEndedByExpiry()) params.set("expired", "1");
      router.replace(`/admin/login?${params.toString()}`);
    }
  }, [token, pathname, router]);

  if (!token) return <AdminLoading />;

  return (
    <div className="flex min-h-screen flex-col bg-muted lg:flex-row">
      <aside className="shrink-0 bg-ink px-3 py-5 text-white lg:w-[220px]">
        <div className="flex items-center gap-2 px-2 pb-5">
          <Logo href="/admin" markClassName="size-7" textClassName="text-base" label="Nearpaw Admin" />
        </div>
        <nav aria-label="Admin" className="flex gap-0.5 overflow-x-auto lg:flex-col">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-[10px] px-3 py-2.5 text-p1 no-underline ${
                  active ? "bg-brand font-bold text-ink" : "font-semibold text-[#d9d9d9] hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 hidden px-2 lg:block">
          <p className="text-p3 text-[#d9d9d9]">Signed in as</p>
          <p className="text-p2 font-bold">Admin · MFA on</p>
          <button
            type="button"
            onClick={() => {
              clearAdminSession();
              router.replace("/admin/login");
            }}
            className="mt-3 cursor-pointer text-p2 font-semibold text-[#d9d9d9] underline hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1 p-6">{children}</div>
    </div>
  );
}
