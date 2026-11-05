import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteHeader, type SiteSection } from "./site-header";

/** Header + main + footer for every public page except the landing page and shared-report page. */
export function SiteShell({ current, children }: { current?: SiteSection; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <SiteHeader current={current} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Standard content column under the header. */
export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1120px] px-6 pb-14 pt-10 ${className}`}>{children}</div>;
}

export function Breadcrumb({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-p3 text-ink-muted">{children}</p>;
}
