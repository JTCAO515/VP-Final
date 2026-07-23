import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Terms of Use | VisePanda",
  description: "The current rules and service boundaries for using VisePanda.",
};

export default function TermsPage() {
  return <LegalPage document={LEGAL_DOCUMENTS.terms} />;
}
