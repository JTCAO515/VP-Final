import type { Metadata } from "next";
import { HomeShell } from "../home";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function HomepagePage() {
  return <HomeShell />;
}
