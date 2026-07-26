import { z } from "zod";

export const PartnerStatusSchema = z.enum(["pending", "active", "inactive"]);

const PartnerHostSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(253)
  .refine(isBareHostname, "Partner hosts must be bare DNS hostnames");

const TrackingParameterSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_.~-]+$/, "Tracking parameter is invalid");

const HttpsOutboundUrlSchema = z
  .string()
  .url()
  .refine(isSafeHttpsUrl, "Only HTTPS outbound URLs without credentials are allowed");

export const PartnerSchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    hosts: z.array(PartnerHostSchema).min(1),
    categories: z.array(z.string().trim().min(1)).default([]),
    cities: z.array(z.string().trim().min(1)).default([]),
    trackingParam: TrackingParameterSchema,
    status: PartnerStatusSchema,
  })
  .superRefine((partner, context) => {
    if (new Set(partner.hosts).size !== partner.hosts.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hosts"],
        message: "Partner hosts must be unique",
      });
    }
  });

export const OutboundClickSchema = z.object({
  id: z.string().min(1),
  partner: z.string().min(1),
  targetUrl: HttpsOutboundUrlSchema,
  source: z.string().optional(),
  intent: z.string().optional(),
  entityId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const OutboundClickRecordSchema = OutboundClickSchema.extend({
  userId: z.string().uuid().nullable(),
  anonId: z.string().min(16).max(128).nullable(),
}).superRefine((click, context) => {
  if (Number(click.userId !== null) + Number(click.anonId !== null) !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["userId"],
      message: "Outbound clicks require exactly one trusted identity",
    });
  }
});

export type Partner = z.infer<typeof PartnerSchema>;
export type OutboundClick = z.infer<typeof OutboundClickSchema>;
export type OutboundClickRecord = z.infer<typeof OutboundClickRecordSchema>;

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
  if (!partner) throw new Error("Unknown partner");

  return buildApprovedOutboundUrl({ partner, targetUrl: input.targetUrl, clickId: input.clickId });
}

export function buildApprovedOutboundUrl(input: {
  partner: Partner;
  targetUrl: string;
  clickId: string;
}): string {
  const partner = PartnerSchema.parse(input.partner);
  if (partner.status !== "active") throw new Error("Partner is not active");

  const hostname = httpsHostname(input.targetUrl);
  if (!partner.hosts.some((host) => hostMatches(hostname, host))) {
    throw new Error("Outbound URL host is not whitelisted");
  }

  return appendQueryParam(input.targetUrl, partner.trackingParam, input.clickId);
}

function hostMatches(hostname: string, allowedHost: string): boolean {
  return hostname.toLowerCase() === allowedHost.toLowerCase();
}

function isBareHostname(value: string): boolean {
  if (value.includes(":") || value.includes("/") || value.includes("@")) return false;
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
    value,
  );
}

function httpsHostname(targetUrl: string): string {
  const hostname = parseSafeHttpsHostname(targetUrl);
  if (!hostname) {
    throw new Error("Only HTTPS outbound URLs without credentials are allowed");
  }
  return hostname;
}

function appendQueryParam(targetUrl: string, key: string, value: string): string {
  const hashIndex = targetUrl.indexOf("#");
  const withoutHash = hashIndex === -1 ? targetUrl : targetUrl.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : targetUrl.slice(hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const base = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);
  const retained = query
    .split("&")
    .filter(Boolean)
    .filter((part) => safeDecode(part.split("=", 1)[0] ?? "") !== key);
  retained.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return `${base}?${retained.join("&")}${hash}`;
}

function isSafeHttpsUrl(value: string): boolean {
  return parseSafeHttpsHostname(value) !== null;
}

function parseSafeHttpsHostname(value: string): string | null {
  if (value.trim() !== value) return null;
  const match = /^https:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(value);
  const authority = match?.[1] ?? "";
  if (!authority || authority.includes("@") || authority.includes(":")) return null;
  const hostname = authority.toLowerCase();
  return isBareHostname(hostname) ? hostname : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
