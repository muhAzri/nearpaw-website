import type { Metadata } from "next";
import { NotFoundView } from "@/frontend/features/content";
import { CookieBanner } from "@/frontend/shared/ui/site/cookie-banner";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <NotFoundView />
      <CookieBanner />
    </>
  );
}
