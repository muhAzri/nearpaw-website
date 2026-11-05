import { CookieBanner } from "@/frontend/shared/ui/site/cookie-banner";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <CookieBanner />
    </>
  );
}
