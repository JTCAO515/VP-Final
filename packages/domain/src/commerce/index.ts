import { z } from "zod";

export const PartnerStatusSchema = z.enum(["pending", "active", "inactive"]);

export const PartnerSchema = z.object({
  key: z.string().min(1),
  hosts: z.array(z.string().min(1)).min(1),
  categories: z.array(z.string().min(1)).default([]),
  cities: z.array(z.string().min(1)).default([]),
  trackingParam: z.string().min(1),
  status: PartnerStatusSchema,
});

export const OutboundClickSchema = z.object({
  id: z.string().min(1),
  partner: z.string().min(1),
  targetUrl: z.string().url(),
  source: z.string().optional(),
  intent: z.string().optional(),
  entityId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type Partner = z.infer<typeof PartnerSchema>;
export type OutboundClick = z.infer<typeof OutboundClickSchema>;

export const PARTNERS: Partner[] = [
  {
    key: "tripcom",
    hosts: ["trip.com", "www.trip.com"],
    categories: ["hotel"],
    cities: ["Beijing", "Shanghai"],
    trackingParam: "vp_click_id",
    status: "pending",
  },
  {
    key: "klook",
    hosts: ["klook.com", "www.klook.com"],
    categories: ["attraction", "experience"],
    cities: ["Beijing", "Shanghai"],
    trackingParam: "vp_click_id",
    status: "pending",
  },
  {
    key: "getyourguide",
    hosts: ["getyourguide.com", "www.getyourguide.com"],
    categories: ["attraction", "experience"],
    cities: ["Beijing", "Shanghai"],
    trackingParam: "vp_click_id",
    status: "pending",
  },
  {
    key: "airalo",
    hosts: ["airalo.com", "www.airalo.com"],
    categories: ["esim"],
    cities: [],
    trackingParam: "vp_click_id",
    status: "pending",
  },
];

export function createOutboundClick(input: {
  id: string;
  partner: string;
  targetUrl: string;
  source?: string;
  intent?: string;
  entityId?: string;
  now?: Date;
}): OutboundClick {
  return OutboundClickSchema.parse({
    id: input.id,
    partner: input.partner,
    targetUrl: input.targetUrl,
    source: input.source,
    intent: input.intent,
    entityId: input.entityId,
    createdAt: (input.now ?? new Date()).toISOString(),
  });
}

export function buildOutboundUrl(input: {
  partnerKey: string;
  targetUrl: string;
  clickId: string;
}): string {
  const partner = PARTNERS.find((candidate) => candidate.key === input.partnerKey);
  if (!partner || partner.status === "inactive") throw new Error("Unknown partner");

  const hostname = httpsHostname(input.targetUrl);
  if (!partner.hosts.some((host) => hostMatches(hostname, host))) {
    throw new Error("Outbound URL host is not whitelisted");
  }

  return appendQueryParam(input.targetUrl, partner.trackingParam, input.clickId);
}

function hostMatches(hostname: string, allowedHost: string): boolean {
  const host = hostname.toLowerCase();
  const allowed = allowedHost.toLowerCase();
  return host === allowed || host.endsWith(`.${allowed}`);
}

function httpsHostname(targetUrl: string): string {
  if (!targetUrl.toLowerCase().startsWith("https://")) {
    throw new Error("Only https outbound URLs are allowed");
  }

  const authority = targetUrl.slice("https://".length).split(/[/?#]/, 1)[0] ?? "";
  const hostPort = authority.includes("@")
    ? authority.slice(authority.lastIndexOf("@") + 1)
    : authority;
  const hostname = hostPort.split(":", 1)[0] ?? "";
  if (!hostname) throw new Error("Outbound URL host is not whitelisted");
  return hostname;
}

function appendQueryParam(targetUrl: string, key: string, value: string): string {
  const hashIndex = targetUrl.indexOf("#");
  const base = hashIndex === -1 ? targetUrl : targetUrl.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : targetUrl.slice(hashIndex);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
}
