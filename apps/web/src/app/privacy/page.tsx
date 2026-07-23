import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | VisePanda",
  description: "How VisePanda processes, protects, retains, and deletes information.",
};

export default function PrivacyPage() {
  return <LegalPage document={LEGAL_DOCUMENTS.privacy} />;
}
