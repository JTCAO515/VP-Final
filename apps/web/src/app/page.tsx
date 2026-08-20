import type { Metadata } from "next";
import { EarlyAccessLanding } from "./_landing/landing";

export const metadata: Metadata = {
  title: "VisePanda | Plan and execute China travel with AI",
  description: "The AI planning and execution workspace for independent travel in China.",
};

export default function Page() {
  return <EarlyAccessLanding />;
}
