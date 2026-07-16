import { SiteFooter, SiteHeader } from "./site-chrome";

export default function NotFound() {
  return (
    <main className="shell notFoundPage">
      <SiteHeader context="Page not found" />
      <section className="notFoundContent">
        <p className="pageEyebrow">404 · Wrong turn</p>
        <h1>This page is not on the itinerary.</h1>
        <p>The link may have changed, or the shared page may no longer be available.</p>
        <div className="notFoundActions">
          <a className="primaryAction" href="/">
            Return to Copilot
          </a>
          <a className="secondaryAction" href="/explore">
            Explore China
          </a>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
