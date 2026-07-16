import { AccountPanel } from "./panel";
import { SiteFooter, SiteHeader } from "../site-chrome";

export default function AccountPage() {
  return (
    <main className="shell accountPage">
      <SiteHeader active="account" context="Traveler account" />
      <AccountPanel />
      <SiteFooter />
    </main>
  );
}
