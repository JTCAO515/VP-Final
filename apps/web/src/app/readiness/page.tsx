import { ReadinessCheck } from "./readiness-check";
import { SiteFooter, SiteHeader } from "../site-chrome";

export const metadata = {
  title: "China Readiness Check | VisePanda",
  description: "An explainable self-check for practical preparation before travelling to China.",
};

export default function ReadinessPage() {
  return (
    <main className="shell readinessPage">
      <SiteHeader contextKey="context.readiness" />
      <ReadinessCheck />
      <SiteFooter />
    </main>
  );
}
