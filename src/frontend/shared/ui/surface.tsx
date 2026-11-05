import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-card border border-border bg-surface p-4 ${className}`} {...props} />;
}

/** Pale-yellow callout for safety and freshness notices. */
export function Note({
  children,
  icon = "info",
  className = "",
}: {
  children: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <div className={`flex gap-2.5 rounded-card border border-border bg-notice px-3.5 py-3 ${className}`}>
      <Icon name={icon} className="mt-0.5" />
      <div className="text-p2">{children}</div>
    </div>
  );
}

/** Standard reminder shown wherever help could be mistaken for a rescue promise. */
export function EmergencyNote({ className = "" }: { className?: string }) {
  return (
    <Note className={className}>
      <span className="font-bold">Nearpaw is not an emergency or rescue service.</span> For urgent danger, contact local
      animal control or emergency services.
    </Note>
  );
}

/** Page-level heading in the display face. */
export function PageTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-display text-4xl leading-[52px] ${className}`}>{children}</h1>;
}

/** Content heading used inside long-form pages. */
export function SectionHeading({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`font-display text-xl leading-8 ${className}`}>
      {children}
    </h2>
  );
}
