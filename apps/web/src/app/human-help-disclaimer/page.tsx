import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Human Help Disclaimer | VisePanda",
  description: "The availability, capacity, safety, and payment limits of Human Help.",
};

export default function HumanHelpDisclaimerPage() {
  return <LegalPage document={LEGAL_DOCUMENTS["human-help"]} />;
}
