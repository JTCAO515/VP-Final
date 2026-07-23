export const LEGAL_EFFECTIVE_DATE = "July 24, 2026";
export const LEGAL_CONTACT_EMAIL = "admin@go2china.space";

// Keep public trust copy in this typed source so every legal route uses the same accepted baseline.

export type LegalDocumentId = "privacy" | "terms" | "affiliate" | "human-help" | "emergency";

type LegalLink = Readonly<{
  href: string;
  label: string;
}>;

type LegalSection = Readonly<{
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  links?: readonly LegalLink[];
}>;

export type LegalDocument = Readonly<{
  id: LegalDocumentId;
  title: string;
  eyebrow: string;
  summary: string;
  sections: readonly LegalSection[];
}>;

const controller = "广州创竞科技有限公司";

export const LEGAL_DOCUMENTS: Readonly<Record<LegalDocumentId, LegalDocument>> = {
  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    eyebrow: "How we handle information",
    summary:
      "This policy explains what VisePanda processes, why it is needed, who helps us process it, and how to request access or deletion.",
    sections: [
      {
        heading: "Who is responsible",
        paragraphs: [
          `${controller}, located in Guangzhou, China, is the operator and data controller for VisePanda. Privacy questions can be sent to ${LEGAL_CONTACT_EMAIL}.`,
          "This policy applies to the VisePanda website and its current controlled-preview services. It does not replace the privacy terms of a partner website you choose to visit.",
        ],
      },
      {
        heading: "Information we process",
        bullets: [
          "Account identity and email when you register or sign in.",
          "Signed anonymous and session identifiers used for continuity, security, and product limits.",
          "Messages, Trip content, and the context needed to answer a Copilot request.",
          "Human Help request details and the reply contact you choose to provide.",
          "Provider, model, token, latency, and cost metadata that does not contain provider credentials.",
          "Product and security events plus necessary network and device operational metadata.",
        ],
      },
      {
        heading: "Why we process it",
        bullets: [
          "Provide, secure, troubleshoot, and improve the requested VisePanda experience.",
          "Maintain your session and Trip, enforce abuse and anonymous-use limits, and diagnose failures.",
          "Route relevant Copilot content to a configured model provider and return the validated result.",
          "Review a Human Help request within the published controlled-preview boundary.",
          "Measure service reliability and reconcile model usage and operating costs.",
        ],
      },
      {
        heading: "Service providers and processing locations",
        paragraphs: [
          "Current service providers are Vercel, Supabase, Upstash, and the configured model providers DashScope/Qwen, DeepSeek, Moonshot/Kimi, and Zhipu/GLM. They process only the information needed for their role in hosting, authentication, storage, rate limiting, or model inference.",
          "Processing may occur in China or other locations outside your home country. Privacy rules can differ between locations. We do not claim a transfer mechanism that has not been reviewed and implemented.",
        ],
      },
      {
        heading: "Retention and deletion",
        paragraphs: [
          "We retain information only while it is needed for the purposes above and for applicable security, dispute, fraud-prevention, legal, or accounting needs. Different record classes can have different internal retention periods. We do not promise a specific public duration for every record class until production purge controls are verified.",
          `To request access, correction, or deletion, email ${LEGAL_CONTACT_EMAIL} from your account email with the subject “VisePanda Data Deletion Request.” We will acknowledge the request within 7 calendar days and aim to complete deletion from active systems within 30 calendar days, or sooner when applicable law requires.`,
          "We use the minimum additional information needed to verify identity. If a record must be retained for a lawful, security, dispute, fraud-prevention, or immutable accounting reason, we will explain the category, reason, and expected expiry instead of claiming immediate deletion.",
        ],
        links: [
          {
            href: `mailto:${LEGAL_CONTACT_EMAIL}?subject=VisePanda%20Data%20Deletion%20Request`,
            label: "Email a privacy request",
          },
        ],
      },
      {
        heading: "Security, age, and updates",
        paragraphs: [
          "We use technical and organizational controls intended to minimize and protect information, but no online service can promise absolute security.",
          "VisePanda is for people aged 16 or older. Do not use the service if you are under 16.",
          "We may update this policy as the product or applicable requirements change. A material update will use a new effective date on this page.",
        ],
      },
    ],
  },
  terms: {
    id: "terms",
    title: "Terms of Use",
    eyebrow: "Rules for using VisePanda",
    summary:
      "These terms describe the current planning, travel-information, and controlled-preview service boundary.",
    sections: [
      {
        heading: "Operator and eligibility",
        paragraphs: [
          `${controller}, located in Guangzhou, China, operates VisePanda. You must be at least 16 years old to use the service. By using VisePanda, you agree to these terms and applicable mandatory law.`,
          "No exclusive court, forum, or governing-law promise is made in this controlled preview. Nothing in these terms removes rights or obligations that cannot be removed under applicable law.",
        ],
      },
      {
        heading: "What the service provides",
        paragraphs: [
          "VisePanda provides travel planning, structured Trip information, practical guidance, and limited manual-request intake. Copilot output can be incomplete, outdated, or wrong. Verify safety-critical, ticketing, entry, legal, medical, and booking information with the appropriate official or qualified source.",
          "A Trip, place, route, price, opening time, availability, or recommendation is information, not a reservation, inventory hold, guarantee, or promise that a third party will perform.",
        ],
      },
      {
        heading: "Accounts and acceptable use",
        bullets: [
          "Provide accurate information and protect your account and reply channels.",
          "Do not submit another person's sensitive information without authority.",
          "Do not abuse, disrupt, scrape, reverse engineer, or bypass service limits or security controls.",
          "Do not use VisePanda for unlawful, unsafe, deceptive, discriminatory, or rights-infringing activity.",
        ],
      },
      {
        heading: "Third parties and affiliate links",
        paragraphs: [
          "Third-party services are responsible for their own content, availability, prices, terms, privacy practices, and performance. Review their terms before acting.",
          "Some clearly disclosed outbound links may be affiliate links. VisePanda may receive a commission from an eligible partner action. See the Affiliate Disclosure before using a commercial link.",
        ],
        links: [{ href: "/affiliate-disclosure", label: "Read the Affiliate Disclosure" }],
      },
      {
        heading: "Human Help and emergencies",
        paragraphs: [
          "Human Help is a best-effort controlled preview for limited Shanghai requests. Submitting a request does not guarantee a reply, booking, outcome, price, or completion and does not create paid work.",
          "VisePanda is not an emergency, medical, police, fire, legal, immigration, payment, account-access, or consular service. Use the appropriate official channel when urgent help is needed.",
        ],
        links: [
          { href: "/human-help-disclaimer", label: "Read the Human Help limits" },
          { href: "/emergency-disclaimer", label: "Read the Emergency Disclaimer" },
        ],
      },
      {
        heading: "Availability and changes",
        paragraphs: [
          "Features can be changed, suspended, limited, or unavailable. We do not promise uninterrupted access or a response-time SLA. We may restrict access when needed for security, misuse prevention, legal compliance, or service integrity.",
          `Questions about these terms can be sent to ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  affiliate: {
    id: "affiliate",
    title: "Affiliate Disclosure",
    eyebrow: "How partner links work",
    summary:
      "VisePanda may receive a commission when an eligible traveler action follows a clearly disclosed partner link.",
    sections: [
      {
        heading: "When a link is commercial",
        paragraphs: [
          "A commercial action must be clearly labelled before or next to the link. Ordinary Copilot planning and advice must not contain an undisclosed commercial action.",
          "The presence of this general page does not turn every external link into an affiliate link. Check the disclosure attached to the specific action.",
        ],
      },
      {
        heading: "What VisePanda may receive",
        paragraphs: [
          "VisePanda may receive a commission or attribution credit if an eligible action or purchase is completed under the partner's rules. A click alone is not proof of revenue.",
          "VisePanda does not currently collect payment for the controlled-preview Human Help service and does not present an affiliate click as a completed booking or purchase.",
        ],
      },
      {
        heading: "Partner responsibility",
        paragraphs: [
          "The partner controls its inventory, price, eligibility, checkout, cancellation, refund, customer support, and privacy practices. VisePanda does not guarantee those details or the partner's performance.",
          "Review the partner's current terms and final checkout information before completing an action.",
        ],
      },
      {
        heading: "Attribution information",
        paragraphs: [
          "An eligible outbound action may record a pseudonymous click id, partner, source surface, intent or related item, and time so the action can be audited. VisePanda does not place provider credentials in that record.",
          `Questions about an affiliate disclosure can be sent to ${LEGAL_CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  "human-help": {
    id: "human-help",
    title: "Human Help Disclaimer",
    eyebrow: "Controlled-preview service limits",
    summary:
      "Human Help is limited manual triage, not guaranteed fulfillment, emergency response, or a paid service.",
    sections: [
      {
        heading: "Current availability",
        bullets: [
          "Shanghai requests only.",
          "English traveler requests.",
          "Review window: 09:00–21:00 China Standard Time, seven days a week.",
          "Capacity: at most five new requests per operating day.",
          "Manual, best-effort review with no guaranteed response or service-level agreement.",
        ],
      },
      {
        heading: "Submitting is not fulfillment",
        paragraphs: [
          "A submitted request enters manual review. It does not guarantee that VisePanda will accept, complete, book, call, translate, purchase, reserve, or obtain any third-party outcome.",
          "The controlled preview has no payment. Do not send card details, passwords, one-time codes, passport credentials, or account access information. No operator may hold money or log in to your account.",
        ],
      },
      {
        heading: "Requests we cannot handle",
        paragraphs: [
          "Human Help is not emergency, medical, legal, visa, immigration, police, fire, payment, insurance, account-access, or consular support. Unsafe, unlawful, abusive, unsupported, or out-of-scope requests can be declined.",
          "For an urgent situation, do not wait for a Human Help response. Contact the appropriate official local service, your accommodation, insurer, or embassy or consulate.",
        ],
        links: [{ href: "/emergency-disclaimer", label: "Open emergency guidance" }],
      },
      {
        heading: "Information and contact",
        paragraphs: [
          "Submit only the city, task type, short description, and one reply channel needed for review. Prefer email and avoid unnecessary sensitive information.",
          `Questions about the preview boundary can be sent to ${LEGAL_CONTACT_EMAIL}.`,
        ],
        links: [{ href: "/human-help", label: "Return to Human Help" }],
      },
    ],
  },
  emergency: {
    id: "emergency",
    title: "Emergency Disclaimer",
    eyebrow: "Use official help for urgent situations",
    summary:
      "VisePanda is not an emergency, medical, police, fire, or consular response service and does not monitor requests for emergencies.",
    sections: [
      {
        heading: "Do not wait for VisePanda",
        paragraphs: [
          "If anyone is in immediate danger, seriously ill or injured, or facing a fire or crime, contact the appropriate official service now. Do not submit or wait for a Copilot or Human Help response.",
          "If you cannot communicate safely, ask a nearby person, your accommodation, venue staff, or another trusted local contact to help call and state your location.",
        ],
      },
      {
        heading: "Mainland China emergency numbers",
        bullets: [
          "Police: 110.",
          "Fire: 119.",
          "Medical emergency: 120.",
          "Traffic accident police: 122.",
        ],
        paragraphs: [
          "Language availability can vary by city and situation. Clearly provide your location, what happened, and a callback number when it is safe to do so.",
        ],
        links: [
          {
            href: "https://english.shanghai.gov.cn/en-EmergencyNumbers/20240104/8eec5a3d2b864187af8f383cc6b94ae5.html",
            label: "Official Shanghai public-service hotline reference",
          },
        ],
      },
      {
        heading: "Other official help",
        paragraphs: [
          "For a lost passport or consular issue, contact local police where appropriate and your country's embassy or consulate. For travel-insurance assistance, contact your insurer using the policy's official channel.",
          "VisePanda does not verify an emergency outcome, dispatch responders, provide diagnosis, or replace qualified local professionals.",
        ],
      },
    ],
  },
};
