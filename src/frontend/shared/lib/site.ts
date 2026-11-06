/** Public origin used for canonical and Open Graph URLs. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const SITE_NAME = "Nearpaw";
export const COMPANY_NAME = "Lambda Interactive";
/** Year of the build; good enough for a footer and avoids reading the clock while rendering. */
export const COPYRIGHT_YEAR = new Date().getFullYear();
export const SUPPORT_EMAIL = "support@lambdainteractive.xyz";

/** App Store Connect Apple ID of the app. */
export const APP_STORE_ID = "6831589473";
/** App Store listing. NEXT_PUBLIC_APP_STORE_URL overrides the default (e.g. a localized storefront link). */
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? `https://apps.apple.com/app/id${APP_STORE_ID}`;

/** Custom URL scheme the iOS app registers; used by "Open in the Nearpaw app". */
const APP_SCHEME = process.env.NEXT_PUBLIC_APP_SCHEME ?? "nearpaw";
export const appReportLink = (ref: string) => `${APP_SCHEME}://reports/${encodeURIComponent(ref)}`;

export const EMERGENCY_NOTICE = "Nearpaw is not an emergency or rescue service.";
export const EMERGENCY_ADVICE = "For urgent danger, contact local animal control or emergency services.";
