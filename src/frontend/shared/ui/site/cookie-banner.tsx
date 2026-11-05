"use client";

import { useState, useSyncExternalStore } from "react";
import {
  cookieBannerVisible,
  getCookieConsent,
  openCookieSettings,
  setCookieConsent,
  subscribeCookieConsent,
} from "@/frontend/shared/lib/cookie-consent";
import { Button } from "../button";
import { Switch } from "../form";

/** Opt-in analytics notice. Nothing is loaded until the visitor accepts. */
export function CookieBanner() {
  const visible = useSyncExternalStore(subscribeCookieConsent, cookieBannerVisible, () => false);
  const [managing, setManaging] = useState(false);
  const [analytics, setAnalytics] = useState(() => getCookieConsent() === "accepted");

  if (!visible) return null;

  const choose = (accepted: boolean) => {
    setCookieConsent(accepted ? "accepted" : "rejected");
    setManaging(false);
  };

  return (
    <section
      aria-label="Cookies and analytics"
      className="fixed inset-x-4 bottom-4 z-50 rounded-sheet border border-border bg-surface p-4 shadow-float sm:right-auto sm:w-[560px]"
    >
      <p className="text-p2 font-bold">Cookies and analytics</p>
      <p className="mt-0.5 text-p3 text-ink-muted">
        We only load analytics if you accept. You can change this any time from Cookie settings.
      </p>
      {managing && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-card bg-muted px-3 py-2.5">
          <div>
            <p className="text-p2 font-bold">Analytics</p>
            <p className="text-p3 text-ink-muted">Helps us see which pages are used. Never used for ads.</p>
          </div>
          <Switch checked={analytics} onChange={setAnalytics} label="Analytics" />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {managing ? (
          <Button size="sm" onClick={() => choose(analytics)}>
            Save choice
          </Button>
        ) : (
          <>
            <Button size="sm" onClick={() => choose(true)}>
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => choose(false)}>
              Reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setManaging(true)}>
              Manage
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

/** Footer link that reopens the banner. */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={openCookieSettings} className={`cursor-pointer underline ${className}`}>
      Cookie settings
    </button>
  );
}
