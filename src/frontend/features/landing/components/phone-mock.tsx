import type { ReactNode } from "react";
import { Icon } from "@/frontend/shared/ui/icon";
import { Tag } from "@/frontend/shared/ui/tag";

const CAT = "M3.5 3.5 8 6.5h8l4.5-3V12a8.5 8.5 0 0 1-17 0z";
const DOG = "M9 4h6l3 2 3 4-3.5 1.5V16a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4v-4.5L3 10l3-4z";

/** Map badge: urgency by colour + marker shape ("!" for high, double ring for medium) + the word in the sheet. */
function MapBadge({ urgency, path, left, top }: { urgency: "high" | "medium"; path: string; left: number; top: number }) {
  const high = urgency === "high";
  const fill = high ? "bg-danger text-white" : "bg-warn text-ink shadow-[0_0_0_2px_var(--warn)]";
  return (
    <div className="absolute h-12 w-10" style={{ left, top }}>
      <div className={`absolute left-3 top-[30px] z-[1] size-4 rotate-45 rounded-br border-[3px] border-l-0 border-t-0 border-white ${high ? "bg-danger" : "bg-warn"}`} />
      <div className={`absolute left-0 top-0 z-[2] flex size-10 items-center justify-center rounded-full border-[3px] border-white ${fill}`}>
        <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden="true">
          <path d={path} />
        </svg>
      </div>
      {high && (
        <span className="absolute -right-[7px] -top-[7px] z-[3] size-[18px] rounded-full border-2 border-white bg-ink text-center text-[11px] font-bold leading-[14px] text-white">
          !
        </span>
      )}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      role="img"
      aria-label="Preview of the Nearpaw map showing a cluster of four reports, a high-urgency cat and a medium-urgency dog, with an injured cat report open at the bottom."
      className="relative h-[580px] w-[290px] overflow-hidden rounded-[44px] border-[10px] border-ink bg-[#f1efe9]"
    >
      {children}
    </div>
  );
}

/** Illustrated phone for the hero. Pure markup: no real map or data. */
export function PhoneMock() {
  return (
    <Frame>
      <svg viewBox="0 0 270 560" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
        <rect width="270" height="560" fill="#f1efe9" />
        <path d="M-10 60 C40 40 90 90 140 80 S230 40 290 60 V-10 H-10Z" fill="#cfe3ee" />
        <rect x="170" y="300" width="80" height="70" rx="14" fill="#d9ead0" />
        <g fill="none" stroke="#fff" strokeLinecap="round">
          <path d="M-10 190 C60 170 120 210 190 190 S250 175 290 185" strokeWidth="14" />
          <path d="M85 100 C95 200 60 330 100 580" strokeWidth="12" />
          <path d="M200 90 C190 230 230 340 200 580" strokeWidth="10" />
          <path d="M-10 330 L290 300" strokeWidth="9" />
          <path d="M140 100 V580 M-10 250 H290" strokeWidth="4" />
        </g>
      </svg>
      <div className="absolute left-[58px] top-[150px] flex size-11 items-center justify-center rounded-full border-[3px] border-white bg-ink text-p1 font-bold text-white shadow-[0_0_0_4px_rgb(20_184_166/0.35)]">
        4
      </div>
      <MapBadge urgency="high" path={CAT} left={120} top={210} />
      <MapBadge urgency="medium" path={DOG} left={190} top={160} />
      <div className="absolute inset-x-0 bottom-0 h-[150px] rounded-t-sheet border-t border-border bg-surface px-3.5 py-2.5">
        <div className="mx-auto mb-2.5 h-[5px] w-9 rounded-full bg-[#d9d9d9]" />
        <p className="text-p1 font-bold">Injured cat</p>
        <p className="text-p3 text-ink-muted">400 m · 2 h ago</p>
        <div className="mt-2 flex gap-1.5">
          <Tag tone="high">
            <Icon name="alert" className="size-3" />
            High urgency
          </Tag>
          <Tag>Published</Tag>
        </div>
      </div>
    </Frame>
  );
}
