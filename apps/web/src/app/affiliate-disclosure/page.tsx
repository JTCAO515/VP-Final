import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Affiliate Disclosure | VisePanda",
  description: "How clearly disclosed VisePanda partner links and commissions work.",
};

export default function AffiliateDisclosurePage() {
  return <LegalPage document={LEGAL_DOCUMENTS.affiliate} />;
}
