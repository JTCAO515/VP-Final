import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { ArrivalPackWorkspace } from "./arrival-pack-workspace";

export const metadata: Metadata = {
  title: "Arrival Pack | VisePanda",
  description: "Create a privacy-minimized, printable first-day travel pack for offline use.",
};

export default function ArrivalPackPage() {
  return (
    <main className="shell arrivalPackPage">
      <SiteHeader context="First-day information for offline use" />
      <ArrivalPackWorkspace />
      <SiteFooter />
    </main>
  );
}
