import { SUPPORT_EMAIL } from "@/frontend/shared/lib/site";

/**
 * Legal text, kept apart from layout so the business can edit it without touching components.
 * Anything in [square brackets] is a placeholder that still needs legally reviewed wording.
 */
export const LEGAL_META = { version: "[1.0]", effective: "[date]" } as const;

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

const TBC = "[Text to be completed and legally reviewed.]";

export const PRIVACY: LegalCopy = {
  title: "Privacy Policy",
  questions: true,
  sections: [
    {
      title: "What we collect",
      body: `Your account email address, the reports and photos you post, the exact location you pin on a report, your device and notification token, and usage data. ${TBC}`,
    },
    {
      title: "Exact locations are public",
      body: "Every published report shows the exact pin the reporter set, to anyone. Your name and contact details are never shown. Photos have their metadata removed before they are shown.",
    },
    { title: "Why we use it", body: `To run the map, send alerts you ask for, keep the service safe and improve the app. ${TBC}` },
    {
      title: "Who we share it with",
      body: `Hosting, analytics (Firebase/Google), advertising, email and bot-protection providers. ${TBC}`,
    },
    { title: "How long we keep it", body: `Reports expire from the map automatically. ${TBC}` },
    {
      title: "Deleting your account",
      body: "Your personal data is erased. Reports still live can be kept anonymously or deleted, as you choose.",
    },
    {
      title: "Your rights",
      body: "Access, deletion and correction. Use the in-app delete option or the privacy request form.",
    },
    {
      title: "Transfers, children and changes",
      body: `Our database is in Singapore and some providers operate globally. ${TBC}`,
    },
    { title: "Contact", body: SUPPORT_EMAIL },
  ],
};

export const TERMS: LegalCopy = {
  title: "Terms of Use",
  questions: true,
  sections: [
    { title: "Who can use Nearpaw", body: "[Minimum age and eligibility.]" },
    { title: "Your account", body: "Sign in with your email and a password. Keep your account secure." },
    {
      title: "Your content",
      body: "You keep ownership of what you post and give us a licence to show it. Reports already live may continue anonymously if you delete your account.",
    },
    {
      title: "Public content",
      body: "Reports go live immediately and show the exact pin. Only post what you saw, and never personal information.",
    },
    {
      title: "What isn’t allowed",
      body: "Personal information, graphic gore, harassment, spam and false reports.",
    },
    {
      title: "Removal",
      body: "We may hide or remove content, and restrict accounts that break these rules. Users can flag content.",
    },
    {
      title: "No rescue guarantee",
      body: "Nearpaw is not an emergency or rescue service and gives no medical or professional advice.",
    },
    {
      title: "Ads and impact statements",
      body: "The app shows labelled ads. Impact figures are company allocations, not user donations.",
    },
    { title: "Liability, law and ending", body: "[Governing law, limits of liability and termination.]" },
    { title: "Contact", body: SUPPORT_EMAIL },
  ],
};

export const GUIDELINES: LegalCopy = {
  title: "Community Guidelines",
  questions: true,
  sections: [
    {
      title: "What to report",
      body: "Animals that look injured, sick, abandoned, trapped, or that you think are being mistreated.",
    },
    { title: "Pin the animal, not your home", body: "Reports show the exact pin. Place it where the animal is." },
    {
      title: "What isn’t allowed",
      body: "Personal information, graphic gore, harassment, spam and false or joke reports.",
    },
    {
      title: "Wildlife safety",
      body: "Keep your distance. Never handle or feed wild animals. Contact local wildlife authorities.",
    },
    {
      title: "How moderation works",
      body: "Reports go live right away. Anyone can flag content, and enough flags hide it automatically. Our team reviews flags.",
    },
    { title: "Flagging and blocking", body: "Use the menu on a report to flag it or block the reporter." },
    { title: "Consequences and appeals", body: "We may hide content or restrict accounts. Contact support to appeal." },
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
      body: "Nearpaw is not an emergency or rescue service. We cannot send anyone and cannot promise a response.",
    },
    {
      title: "What to do instead",
      body: "Contact your local animal control, animal shelter or emergency services directly.",
    },
    { title: "Local resources", body: "[Region-specific phone numbers and organisations for each active region.]" },
    { title: "No professional advice", body: "Nothing on Nearpaw is veterinary, medical or legal advice." },
    {
      title: "Community information",
      body: "Updates come from other people and are not verified by Nearpaw. Situations change quickly.",
    },
  ],
};
