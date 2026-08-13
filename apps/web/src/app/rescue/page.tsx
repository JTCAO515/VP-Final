import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { RescueMode } from "./rescue-mode";
import { getRescueRuntimeConfiguration } from "./runtime";

export const metadata: Metadata = {
  title: "Rescue Mode | VisePanda",
  description: "A bounded, deterministic next-step chooser for practical travel problems in China.",
};

// Availability is evaluated against the current China-time operating window.
export const dynamic = "force-dynamic";

export default function RescuePage() {
  const configuration = getRescueRuntimeConfiguration();
  return (
    <main className="shell rescuePage">
      <SiteHeader active="rescue" context="Practical help, with clear limits" />
      <RescueMode configuration={configuration} />
      <SiteFooter />
    </main>
  );
}
