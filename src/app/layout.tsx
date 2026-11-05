import type { Metadata } from "next";
import { Mochiy_Pop_One, Plus_Jakarta_Sans } from "next/font/google";
import { SITE_NAME, SITE_URL } from "@/frontend/shared/lib/site";
import "./globals.css";

// Mochiy Pop One: screen titles and the wordmark. Plus Jakarta Sans: everything else.
const display = Mochiy_Pop_One({ variable: "--font-mochiy", weight: "400", subsets: ["latin"], display: "swap" });
const sans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — see animals in need, right where you are`, template: `%s · ${SITE_NAME}` },
  description:
    "Nearpaw puts community reports of animals in need on a map. Share what you find, see what others have shared, and get calm alerts for the area you choose.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
