type SiteSection = "copilot" | "explore" | "guides" | "rescue" | "help" | "account";

type SiteHeaderProps = Readonly<{
  active?: SiteSection;
  context?: string;
}>;

const NAV_ITEMS: ReadonlyArray<Readonly<{ section: SiteSection; href: string; label: string }>> = [
  { section: "copilot", href: "/visepanda", label: "VisePanda" },
  { section: "explore", href: "/explore", label: "Explore" },
  { section: "guides", href: "/guides/payment", label: "Guides" },
  { section: "rescue", href: "/rescue", label: "Rescue" },
  { section: "help", href: "/human-help", label: "Human Help" },
];

export function SiteHeader({ active, context = "China Travel AI Copilot" }: SiteHeaderProps) {
  return (
    <>
      <a className="skipLink" href="#page-content">
        Skip to main content
      </a>
      <header className="siteHeader">
        <a className="brandMark" href="/" aria-label="VisePanda home">
          <span aria-hidden="true">V</span>
          <b>VisePanda</b>
        </a>
        <nav className="siteNav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <a
              aria-current={active === item.section ? "page" : undefined}
              href={item.href}
              key={item.section}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="siteUtilities">
          <p className="siteContext">
            <span aria-hidden="true" />
            {context}
          </p>
          <a
            aria-current={active === "account" ? "page" : undefined}
            className="siteNavLink siteAccountLink"
            href="/account"
          >
            Account
          </a>
        </div>
      </header>
      <span className="pageContentAnchor" id="page-content" tabIndex={-1} />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <a className="brandMark" href="/" aria-label="VisePanda home">
        <span aria-hidden="true">V</span>
        <b>VisePanda</b>
      </a>
      <p>Practical guidance for confident travel in China.</p>
      <div className="siteFooterLinks">
        <nav aria-label="Product links">
          <a href="/visepanda">VisePanda</a>
          <a href="/readiness">Readiness check</a>
          <a href="/explore">Explore</a>
          <a href="/guides/payment">Guides</a>
          <a href="/rescue">Rescue</a>
          <a href="/human-help">Human Help</a>
          <a href="/account">Account</a>
        </nav>
        <nav aria-label="Trust and legal links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/affiliate-disclosure">Affiliate disclosure</a>
          <a href="/human-help-disclaimer">Human Help limits</a>
          <a href="/emergency-disclaimer">Emergency</a>
        </nav>
      </div>
    </footer>
  );
}
