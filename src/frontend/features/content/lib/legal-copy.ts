import { COMPANY_NAME, SUPPORT_EMAIL } from "@/frontend/shared/lib/site";

/**
 * Legal text, kept apart from layout so the business can edit it without touching components.
 *
 * A section body is plain text; a blank line (`\n\n`) starts a new paragraph. The wording below describes what the
 * app and API actually do (see the `identity`, `reports`, `alerts`, `media` and `support` modules). When behaviour
 * changes (new data, new provider, new retention rule), update the matching section and bump `LEGAL_META`.
 */
export const LEGAL_META = { version: "1.0", effective: "6 November 2026" } as const;

export interface LegalSection {
  title: string;
  body: string;
}

export interface LegalCopy {
  title: string;
  /** Short sentence under the title (optional). */
  lead?: string;
  sections: LegalSection[];
  /** Show the "Questions? <email>" line at the end. */
  questions?: boolean;
}

/** Minimum age confirmed at sign-up. Keep in step with `LegalConstants.minimumAge` in the iOS app. */
const MIN_AGE = 13;

export const PRIVACY: LegalCopy = {
  title: "Privacy Policy",
  lead: `This policy explains what ${COMPANY_NAME} collects through the Nearpaw app and website, why, who it is shared with, and the choices you have.`,
  questions: true,
  sections: [
    {
      title: "Who we are",
      body: `Nearpaw is operated by ${COMPANY_NAME} ("we", "us"). We decide how and why your personal data is used. You can reach us at ${SUPPORT_EMAIL}.`,
    },
    {
      title: "What we collect",
      body: [
        "Account. Your email address and a password. The password is handled by our authentication provider and stored only as a hash; we never see it. We also keep a display name (\"Community member\" unless you change it), a public number such as \"Community #1001\" that is shown instead of your name, and your account status and any warnings.",
        "Reports and updates. For each report: the animal type, condition and urgency, your description (up to 500 characters), up to four photos, the exact pin you set and a place name for it, the language and the time. For each community update: the update type, an optional note (up to 140 characters) and one optional photo.",
        "Location. If you allow it, the app reads your device location only while it is open, to centre the map on you and to suggest where you saw an animal. It never tracks you in the background. When you load nearby reports, the map centre (your location or the place you searched for) is sent to our servers to find reports around it. If you turn on alerts, we store the area you pick (its name, coordinates and radius) and the animal types you want.",
        "Photos and camera. The app asks for camera access so you can photograph an animal. Photos are resized, converted to WebP and stripped of metadata (including GPS data) on your phone before they are uploaded.",
        "Notifications. If you allow notifications, we store your push token and the platform (iOS), and keep the alerts we sent you so they appear in your in-app feed.",
        "Safety and moderation. Flags you submit (the reason and any details, up to 500 characters), the people you block, and warnings or restrictions applied to accounts. Actions taken by our moderators are recorded in an audit log.",
        "Support and privacy requests. If you write to us through the website forms, we keep your email address, your message, the language, an optional report reference or account identifier, and the IP address used to apply rate limits.",
        "Technical data. Our servers and providers process your IP address and request details to deliver the service and keep it secure, and we keep counters of requests and failed sign-ins to prevent abuse.",
        "We do not collect your contacts, your precise location in the background, payment details or health data, and we do not use Firebase Analytics.",
      ].join("\n\n"),
    },
    {
      title: "Exact locations are public",
      body: "Every published report shows the exact pin the reporter set to anyone who uses the app. Your name, email address and other contact details are never shown; reports show only a number such as \"Community #1001\". The public web page for a shared report shows a coarse area only, not the pin, photos or updates. Photos have their metadata removed before they are uploaded, but what a photo shows (for example a street, a house number or a person) is visible to anyone who can see the report, so please photograph only the animal.",
    },
    {
      title: "Why we use it",
      body: [
        "To provide the service: sign you in, show the map and nearby reports, publish your reports and updates, and send the alerts you ask for.",
        "To keep Nearpaw safe: moderate content, handle flags, block abuse, enforce rate limits and sign-in lockouts, and keep an audit trail of moderator actions.",
        "To answer you: handle support messages and privacy requests.",
        "To show ads: the app shows labelled ads served by Google AdMob (see below).",
        "To meet legal obligations and to protect our rights. Where the law requires a legal basis, we rely on performing our contract with you (running your account and the features you use), our legitimate interests in running and securing the service, your consent (for notifications, location and, where required, ad personalisation) and legal obligations.",
      ].join("\n\n"),
    },
    {
      title: "Who we share it with",
      body: [
        "We do not sell your personal data. We share it only as follows.",
        "With everyone: the content of reports and community updates, as described above.",
        "With service providers who process data for us: Supabase (database and sign-in, including the emails for verification and password reset; our database is hosted in Singapore); Cloudflare (R2 storage for photos); Google Firebase Cloud Messaging and Apple Push Notification service (to deliver push notifications); Apple (the map and place search in the app run on Apple Maps, so the area you look at or search for is sent to Apple); and our web hosting provider.",
        "With advertising partners: Google AdMob (see below).",
        "With authorities or other parties when the law requires it, to protect people or animals from serious harm, or to enforce our terms; and with a successor if Nearpaw is transferred to another organisation, who must honour this policy.",
        "Our moderators and support staff see only what they need, and email addresses are masked in the support inbox.",
      ].join("\n\n"),
    },
    {
      title: "Ads",
      body: "The app shows ads served by Google AdMob. To do this Google may collect device information such as your IP address, device identifiers and how you interact with ads. Where the law requires it (for example in the European Economic Area and the United Kingdom), the app first shows Google's consent form and respects your choice. You can limit ad tracking in your iPhone's Settings under Privacy & Security, and you can change your consent choice if the app offers it. Ads are clearly labelled and we do not share your reports, photos or email address with advertisers.",
    },
    {
      title: "How long we keep it",
      body: [
        "Account data is kept while your account is open.",
        "A report is shown on the map until it expires (7 days by default), is closed by its reporter, or is hidden or removed. Afterwards the report text and pin are kept in our records for moderation, abuse prevention, statistics and legal purposes, and are no longer shown publicly. The photos of a report, and of its community updates, are deleted from our storage by an automatic daily job about 3 days after the report expires or is closed, and on the next run once it is removed. Photo files are stored at public web addresses, so until then anyone who has the direct link can still open a photo, and we cannot recall copies other people saved. You can ask us to delete your reports at any time.",
        "Alert settings, push tokens, your alert feed and your block list are deleted when you delete your account. A push token is also deleted when the notification service reports that it no longer works.",
        "Support messages and privacy requests are kept for as long as needed to handle them and to show that we responded. The moderator audit log is append-only and is kept for accountability. Request counters used to prevent abuse, including the IP address in them, are deleted after about a day.",
      ].join("\n\n"),
    },
    {
      title: "Deleting your account",
      body: [
        "You can delete your account in the app. You choose what happens to your live reports: they can stay on the map anonymously (they then show as \"Deleted user\") or be removed from the map straight away.",
        "When you delete your account we remove your email address and display name from your profile, delete your alert settings, push tokens and blocks, and erase your sign-in record (email address and hashed password) from our authentication provider. The account can no longer be used, and you can register again later with the same email address.",
        "Reports that stay anonymous keep their pin and photos until they expire, when the photos are deleted as described above. Content already seen, copied or shared by other people is outside our control.",
      ].join("\n\n"),
    },
    {
      title: "Your rights",
      body: [
        "Depending on where you live (for example under Indonesia's Personal Data Protection Law or the GDPR), you may have the right to access your personal data, correct it, delete it, restrict or object to its use, receive a copy, and withdraw consent at any time.",
        "Use the in-app delete option, change your notification and location choices in the app and in iOS Settings, or send us a request through the privacy request form on our website. We may ask you to confirm that the request comes from the email address on the account. We aim to answer within 30 days. You may also complain to your local data protection authority.",
      ].join("\n\n"),
    },
    {
      title: "Security",
      body: "Data is sent over encrypted connections. Our database tables are locked so that only our servers can read or write them, passwords are stored as hashes, and moderator access is limited to accounts with an admin role. No system is perfectly secure, so please use a strong, unique password.",
    },
    {
      title: "International transfers",
      body: "Our database is in Singapore and some of our providers operate globally, so your data may be processed in other countries. We use providers that apply appropriate safeguards to such transfers.",
    },
    {
      title: "Children",
      body: `Nearpaw is not for children under ${MIN_AGE}. We do not knowingly collect data from them. If you believe a child has created an account, contact us and we will delete it.`,
    },
    {
      title: "Changes to this policy",
      body: "We may update this policy as Nearpaw changes. We will change the version and effective date at the top of this page, and tell you in the app or by email if a change is significant.",
    },
    { title: "Contact", body: `${COMPANY_NAME}, ${SUPPORT_EMAIL}` },
  ],
};

export const TERMS: LegalCopy = {
  title: "Terms of Use",
  lead: "By creating an account or using Nearpaw you agree to these terms. If you do not agree, please do not use the app.",
  questions: true,
  sections: [
    {
      title: "Who we are",
      body: `Nearpaw is operated by ${COMPANY_NAME}. These terms are an agreement between you and ${COMPANY_NAME}, and they apply together with our Privacy Policy, Community Guidelines and Disclaimer.`,
    },
    {
      title: "Who can use Nearpaw",
      body: `You must be at least ${MIN_AGE} years old. If you are under the age of majority where you live, you confirm that a parent or guardian allows you to use Nearpaw. You must not use Nearpaw if we have previously banned your account.`,
    },
    {
      title: "Your account",
      body: "Sign in with your email address and a password. Give us a real email address that you can access, keep your password to yourself, and tell us if you think your account has been misused. You are responsible for what happens under your account. We may limit sign-in attempts to protect accounts.",
    },
    {
      title: "Your content",
      body: [
        "You keep ownership of what you post, including reports, photos, notes and updates. You give us a worldwide, non-exclusive, royalty-free licence to host, store, resize, display and distribute that content in Nearpaw and in the share pages of our website so that the service can work. You also confirm that you took the photos or have the right to use them.",
        "If you delete your account, reports you chose to keep stay on Nearpaw anonymously, and content that has already expired is kept in our records as described in the Privacy Policy. We may keep a copy of content needed for safety, legal or dispute purposes.",
      ].join("\n\n"),
    },
    {
      title: "Public content",
      body: "Reports go live immediately and show the exact pin to everyone who uses the app. Only post what you saw, place the pin where the animal is, and never post personal information about anyone.",
    },
    {
      title: "What isn’t allowed",
      body: "Personal information (for example names, phone numbers, addresses, licence plates or faces of people); graphic gore; harassment, hate or threats; spam, ads or promotion; false, joke or duplicate reports; content you do not have the right to share; using Nearpaw to locate or target a person or their property; scraping or copying the service in bulk; trying to bypass limits or security; and anything illegal. Contact details are not allowed in report text.",
    },
    {
      title: "Flagging, blocking and removal",
      body: "Anyone can flag a report or update, or block a reporter. Enough flags hide content automatically while our team reviews it. We may hide or remove content, warn, restrict, suspend or ban accounts that break these terms or the Community Guidelines, and we may limit how often you can post. If you think we made a mistake, contact support to appeal.",
    },
    {
      title: "No rescue guarantee",
      body: "Nearpaw is not an emergency or rescue service. We cannot send anyone, cannot promise that anyone will respond to a report, and give no medical, veterinary or professional advice. Reports come from other people and are not verified by us. See the Disclaimer.",
    },
    {
      title: "Your safety",
      body: "Use your own judgement. Never put yourself or others in danger to help an animal, keep your distance from wild or injured animals, and follow the guidance of local authorities.",
    },
    {
      title: "Ads and impact statements",
      body: "The app shows labelled ads served by third parties, and we are not responsible for the advertisers or what they offer. Impact figures published by Nearpaw are allocations made by the company. They are not donations by users, and Nearpaw does not collect donations.",
    },
    {
      title: "Availability and changes",
      body: "We provide Nearpaw as a free service and may change, pause or stop any part of it. Some versions of the app may stop working, and you may need to update the app to keep using it. We try to keep the service running but do not promise it will always be available or error-free.",
    },
    {
      title: "Liability",
      body: [
        "Nearpaw and its content are provided \"as is\" and \"as available\", without warranties of any kind, to the extent the law allows. We are not responsible for what users post, for the accuracy of reports, or for what happens to an animal or person after a report.",
        "To the maximum extent permitted by law, we are not liable for indirect or consequential losses, lost profits or lost data, and our total liability for any claim related to Nearpaw is limited to the amount you paid us in the previous 12 months (nothing, because Nearpaw is free). Nothing in these terms excludes liability that cannot be excluded by law, and your legal rights as a consumer are not affected.",
      ].join("\n\n"),
    },
    {
      title: "Ending",
      body: "You can stop using Nearpaw and delete your account at any time in the app. We may suspend or end your access if you break these terms, if the law requires it, or if we stop offering the service. Sections that by their nature should continue (for example content licences, liability and governing law) continue after your account ends.",
    },
    {
      title: "Governing law",
      body: "These terms are governed by the laws of the Republic of Indonesia. Any dispute will first be discussed in good faith, and if it cannot be settled it will be brought before the competent courts in Indonesia, unless mandatory consumer law in your country gives you the right to use your local courts.",
    },
    {
      title: "Changes to these terms",
      body: "We may update these terms. We will change the version and effective date at the top of this page and tell you in the app or by email if the change is significant. Using Nearpaw after the change means you accept the new terms.",
    },
    { title: "Contact", body: `${COMPANY_NAME}, ${SUPPORT_EMAIL}` },
  ],
};

export const GUIDELINES: LegalCopy = {
  title: "Community Guidelines",
  lead: "Nearpaw works when reports are accurate, calm and kind. These guidelines are part of our Terms of Use.",
  questions: true,
  sections: [
    {
      title: "What to report",
      body: "Animals that look injured, sick, abandoned, trapped, or that you think are being mistreated. Choose the animal type, the condition and how urgent it looks, and describe what you actually saw in a few words.",
    },
    {
      title: "Pin the animal, not your home",
      body: "Reports show the exact pin to everyone who uses the app. Place it where the animal is, not where you live, and photograph only the animal.",
    },
    {
      title: "Keep it factual",
      body: "Describe what you saw, when and where. Do not guess at who is to blame. Reports expire automatically (after 7 days by default), so report again if the animal is still there and the report has run out.",
    },
    {
      title: "Community updates",
      body: "If you pass by, add an update: still there, not found, condition changed, or possibly helped. Keep notes short and kind, and add a photo only if it helps.",
    },
    {
      title: "What isn’t allowed",
      body: "Personal information or contact details, graphic gore, harassment, spam and ads, and false or joke reports. Do not post faces, house numbers or licence plates.",
    },
    {
      title: "Wildlife safety",
      body: "Keep your distance. Never handle or feed wild animals. Contact local wildlife authorities, or a rescue group that is trained for the species.",
    },
    {
      title: "How moderation works",
      body: "Reports go live right away. Anyone can flag content, and enough flags hide it automatically. Our team reviews flags and may keep, hide or remove content, or warn or restrict the account that posted it.",
    },
    {
      title: "Flagging and blocking",
      body: "Use the menu on a report or an update to flag it (one flag per person per item), or to block the reporter so you no longer see their reports.",
    },
    {
      title: "Consequences and appeals",
      body: `We may hide content, warn, restrict or ban accounts that break these guidelines. If you think we got it wrong, write to ${SUPPORT_EMAIL} and include the report reference.`,
    },
    { title: "Your safety comes first", body: "Never put yourself in danger to help an animal." },
  ],
};

export const DISCLAIMER: LegalCopy = {
  title: "Disclaimer & Emergency Resources",
  lead: "If you can see a person or animal in immediate danger, contact local emergency services first.",
  questions: true,
  sections: [
    {
      title: "Not an emergency service",
      body: "Nearpaw is not an emergency or rescue service. We cannot send anyone, we cannot promise a response, and a report on the map does not mean that anyone has seen it.",
    },
    {
      title: "What to do instead",
      body: "Contact your local animal control, animal shelter, wildlife authority or veterinarian directly. If a person is in danger, call the emergency number for your country.",
    },
    {
      title: "Local resources",
      body: "Nearpaw can be used anywhere, and we do not keep a directory of rescue organisations for every place. Search for animal control, an animal shelter or a wildlife rescue group in your own city or country, and save their number before you need it.",
    },
    {
      title: "No professional advice",
      body: "Nothing on Nearpaw is veterinary, medical or legal advice.",
    },
    {
      title: "Community information",
      body: "Reports and updates come from other people and are not verified by Nearpaw. Situations change quickly, so an animal may have moved, been helped or never been there. Use your own judgement.",
    },
    {
      title: "Ads and links",
      body: "Ads are provided by third parties. We do not endorse them and are not responsible for their content or for sites you reach through them.",
    },
  ],
};
