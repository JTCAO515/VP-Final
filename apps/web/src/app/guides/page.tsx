import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { GuideIndex } from "./guide-index";
import { GUIDES } from "./data";

export const metadata: Metadata = {
  title: "Guides | VisePanda",
  description: "Practical China travel guides from VisePanda.",
};

export default function GuidesPage() {
  return (
    <main className="shell guidePage">
      <SiteHeader active="guides" />
      <GuideIndex guides={GUIDES} />
      <SiteFooter />
    </main>
  );
}
