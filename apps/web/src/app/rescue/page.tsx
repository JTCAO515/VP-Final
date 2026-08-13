import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { RescueMode } from "./rescue-mode";

export const metadata: Metadata = {
  title: "Rescue Mode | VisePanda",
  description: "A bounded, deterministic next-step chooser for practical travel problems in China.",
};

export default function RescuePage() {
  return (
    <main className="shell rescuePage">
      <SiteHeader active="rescue" context="Practical help, with clear limits" />
      <RescueMode />
      <SiteFooter />
    </main>
  );
}
