import {
  OutboundClickRecordSchema,
  PartnerSchema,
  buildApprovedOutboundUrl,
  type Partner,
} from "@visepanda/domain";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { outboundClicks, partners, users } from "./schema.js";
import {
  InvalidOutboundTargetError,
  PartnerUnavailableError,
  createCommerceService,
  type CommerceService,
  type CreateOutboundRedirectCommand,
  type OutboundClickWriter,
} from "../modules/commerce/service.js";
import type { TelemetryService } from "../modules/telemetry/service.js";

export function createDbCommerceService(
  db: Db,
  options: {
    telemetryService?: TelemetryService;
    now?: () => Date;
    randomId?: () => string;
    onTelemetryError?: () => void;
  } = {},
): CommerceService {
  const now = options.now ?? (() => new Date());
  const randomId = options.randomId ?? (() => crypto.randomUUID());
  const writer: OutboundClickWriter = {
    createRedirect: (input) => createDurableRedirect(db, input, now(), randomId()),
  };
  return createCommerceService({
    writer,
    ...(options.telemetryService ? { telemetryService: options.telemetryService } : {}),
    ...(options.onTelemetryError ? { onTelemetryError: options.onTelemetryError } : {}),
  });
}

async function createDurableRedirect(
  db: Db,
  input: CreateOutboundRedirectCommand,
  createdAt: Date,
  clickId: string,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(partners)
      .where(eq(partners.key, input.partnerKey))
      .for("share")
      .limit(1);
    if (!row || row.status !== "active") throw new PartnerUnavailableError();

    const partner = parsePartner(row);
    let redirectUrl: string;
    try {
      redirectUrl = buildApprovedOutboundUrl({
        partner,
        targetUrl: input.targetUrl,
        clickId,
      });
    } catch {
      throw new InvalidOutboundTargetError();
    }

    if (input.identity.kind === "authenticated") {
      await tx
        .insert(users)
        .values({
          id: input.identity.userId,
          ...(input.identity.email ? { email: input.identity.email } : {}),
        })
        .onConflictDoNothing();
    }

    const click = OutboundClickRecordSchema.parse({
      id: clickId,
      partner: partner.key,
      targetUrl: input.targetUrl,
      userId: input.identity.kind === "authenticated" ? input.identity.userId : null,
      anonId: input.identity.kind === "anonymous" ? input.identity.anonId : null,
      source: input.source,
      intent: input.intent,
      entityId: input.entityId,
      createdAt: createdAt.toISOString(),
    });
    const [inserted] = await tx
      .insert(outboundClicks)
      .values({
        id: click.id,
        partner: click.partner,
        targetUrl: click.targetUrl,
        userId: click.userId,
        anonId: click.anonId,
        source: click.source ?? null,
        intent: click.intent ?? null,
        entityId: click.entityId ?? null,
        createdAt,
      })
      .returning({ id: outboundClicks.id });
    if (!inserted) throw new Error("Outbound click insert returned no record");
    return { click, redirectUrl };
  });
}

function parsePartner(row: typeof partners.$inferSelect): Partner {
  const parsed = PartnerSchema.safeParse({
    key: row.key,
    hosts: row.hosts,
    categories: row.categories,
    cities: row.cities,
    trackingParam: row.trackingParam,
    kind: row.kind,
    status: row.status,
  });
  if (!parsed.success) throw new PartnerUnavailableError();
  return parsed.data;
}
