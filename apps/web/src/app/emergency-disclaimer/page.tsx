import type { Metadata } from "next";
import { LEGAL_DOCUMENTS } from "../legal-content";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = {
  title: "Emergency Disclaimer | VisePanda",
  description: "Official emergency channels and the limits of VisePanda assistance.",
};

export default function EmergencyDisclaimerPage() {
  return <LegalPage document={LEGAL_DOCUMENTS.emergency} />;
}
