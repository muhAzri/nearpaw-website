import { DISCLAIMER, GUIDELINES, PRIVACY, TERMS } from "../lib/legal-copy";
import { LegalDocument } from "./legal-document";

export const PrivacyView = () => <LegalDocument copy={PRIVACY} />;
export const TermsView = () => <LegalDocument copy={TERMS} />;
export const GuidelinesView = () => <LegalDocument copy={GUIDELINES} />;
export const DisclaimerView = () => <LegalDocument copy={DISCLAIMER} />;
