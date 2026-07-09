export type Guide = {
  slug: string;
  title: string;
  description: string;
  ogTitle: string;
  sections: { heading: string; body: string[] }[];
  faqs: { question: string; answer: string }[];
};

export const GUIDES: Guide[] = [
  {
    slug: "payment",
    title: "How to pay in China as a foreign traveler",
    description: "Set up Alipay or WeChat Pay, know when cards work, and keep a cash fallback.",
    ogTitle: "China payment guide for foreign travelers",
    sections: [
      {
        heading: "Before you fly",
        body: [
          "Install Alipay and WeChat before landing, then bind an international Visa or Mastercard while you still have reliable access to email and SMS.",
          "Keep your passport name consistent across airline, hotel, and payment setup. Small spelling mismatches are the boring failure mode.",
        ],
      },
      {
        heading: "On the ground",
        body: [
          "Use QR payments for restaurants, convenience stores, taxis, and attractions. Carry a physical card and a small amount of cash for edge cases.",
          "If a payment fails, try the other wallet, lower the amount, or ask the merchant whether foreign cards are accepted through their QR flow.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I use Apple Pay everywhere in China?",
        answer: "No. QR wallets are far more common than contactless card terminals.",
      },
      {
        question: "Should I bring cash?",
        answer:
          "Yes, but only as a fallback. Most daily spending is easier through Alipay or WeChat Pay.",
      },
    ],
  },
  {
    slug: "esim",
    title: "China eSIM setup checklist",
    description: "Choose an eSIM, install it early, and keep maps and travel cards usable offline.",
    ogTitle: "China eSIM guide for first-time visitors",
    sections: [
      {
        heading: "Pick the right plan",
        body: [
          "Choose a China-compatible eSIM with enough data for maps, translation, ride hailing, and ticket apps. Unlimited plans often throttle, so read the fine print.",
          "If you need Google services, confirm whether the eSIM routes data outside mainland China. Do not assume every plan behaves the same way.",
        ],
      },
      {
        heading: "Install before arrival",
        body: [
          "Install the eSIM at home, but activate it according to the provider instructions. Save the QR code and support email offline.",
          "Download your hotel address, first-day route, and emergency phrases before takeoff in case activation is delayed.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I buy an eSIM after landing?",
        answer:
          "Sometimes, but setup is easier before travel while your normal phone number and email are working.",
      },
      {
        question: "Do all eSIMs work with Google Maps?",
        answer: "No. Check the routing and service notes from the provider before buying.",
      },
    ],
  },
  {
    slug: "network",
    title: "China internet access basics",
    description: "Prepare for app access, map reliability, and offline fallbacks before your trip.",
    ogTitle: "China internet access guide for travelers",
    sections: [
      {
        heading: "Assume some apps will not work",
        body: [
          "Many overseas services are unreliable or unavailable on local networks. Prepare alternatives for maps, messaging, search, translation, and payments.",
          "Tell travel companions where to reach you if your usual messaging app stops working.",
        ],
      },
      {
        heading: "Build an offline fallback",
        body: [
          "Save hotel names in Chinese, key addresses, passport copies, booking references, and first-day transport notes offline.",
          "Keep screenshots of QR codes and confirmations, but remember some tickets require live validation at the gate.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is hotel Wi-Fi enough?",
        answer:
          "Not by itself. You still need mobile data for maps, rides, tickets, and translation outside the hotel.",
      },
      {
        question: "Should I rely on one map app?",
        answer: "No. Keep at least one local-friendly map option and offline address notes.",
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
