import { PartnerSchema, type Partner } from "@visepanda/domain";
import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { opsAuditEvents, partners } from "./schema.js";
import {
  PartnerConfigurationConflictError,
  PartnerConfigurationNotFoundError,
  createPartnerAdministrationService,
  partnerCreatedAudit,
  partnerStatusAudit,
  partnerUpdatedAudit,
  type PartnerAuditInput,
  type PartnerAdministrationService,
  type PartnerAdministrationStore,
} from "../modules/commerce/partnerAdministration.js";

const configurationLock = "visepanda_partner_configuration";

export function createDbPartnerAdministrationService(
  db: Db,
  options: { now?: () => Date } = {},
): PartnerAdministrationService {
  const now = options.now ?? (() => new Date());
  const store: PartnerAdministrationStore = {
    async list() {
      return (await db.select().from(partners).orderBy(asc(partners.key))).map(parsePartner);
    },
    async get(key) {
      const [row] = await db.select().from(partners).where(eq(partners.key, key)).limit(1);
      return row ? parsePartner(row) : null;
    },
    create(input) {
      return db.transaction(async (transaction) => {
        await lockConfiguration(transaction);
        const existing = await transaction.select().from(partners);
        if (existing.some((row) => row.key === input.partner.key)) {
          throw new PartnerConfigurationConflictError("The partner key already exists.");
        }
        assertHostsAvailable(existing.map(parsePartner), input.partner);
        const timestamp = now();
        const [row] = await transaction
          .insert(partners)
          .values(toPartnerValues(input.partner, timestamp))
          .returning();
        if (!row) throw new Error("Partner configuration insert failed.");
        await insertAudit(transaction, input.actorId, partnerCreatedAudit(input.partner));
        return parsePartner(row);
      });
    },
    updateConfiguration(input) {
      return db.transaction(async (transaction) => {
        await lockConfiguration(transaction);
        const rows = await transaction.select().from(partners).orderBy(asc(partners.key));
        const currentRow = rows.find((row) => row.key === input.configuration.key);
        if (!currentRow) throw new PartnerConfigurationNotFoundError();
        const current = parsePartner(currentRow);
        const partner = PartnerSchema.parse({ ...input.configuration, status: current.status });
        assertHostsAvailable(rows.map(parsePartner), partner);
        const [updated] = await transaction
          .update(partners)
          .set({
            hosts: partner.hosts,
            categories: partner.categories,
            cities: partner.cities,
            trackingParam: partner.trackingParam,
            updatedAt: now(),
          })
          .where(eq(partners.key, partner.key))
          .returning();
        if (!updated) throw new Error("Partner configuration update failed.");
        await insertAudit(
          transaction,
          input.actorId,
          partnerUpdatedAudit(current, input.configuration),
        );
        return parsePartner(updated);
      });
    },
    changeStatus(input) {
      return db.transaction(async (transaction) => {
        await lockConfiguration(transaction);
        const [currentRow] = await transaction
          .select()
          .from(partners)
          .where(eq(partners.key, input.key))
          .for("update")
          .limit(1);
        if (!currentRow) throw new PartnerConfigurationNotFoundError();
        const current = parsePartner(currentRow);
        if (current.status === input.status) {
          throw new PartnerConfigurationConflictError("The partner already has that status.");
        }
        const [updated] = await transaction
          .update(partners)
          .set({ status: input.status, updatedAt: now() })
          .where(eq(partners.key, input.key))
          .returning();
        if (!updated) throw new Error("Partner status update failed.");
        await insertAudit(transaction, input.actorId, partnerStatusAudit(current, input.status));
        return parsePartner(updated);
      });
    },
  };
  return createPartnerAdministrationService(store);
}

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function lockConfiguration(transaction: Transaction): Promise<void> {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${configurationLock}))`);
}

async function insertAudit(
  transaction: Transaction,
  actorId: string,
  audit: PartnerAuditInput,
): Promise<void> {
  const [row] = await transaction
    .insert(opsAuditEvents)
    .values({
      actorId,
      action: audit.action,
      targetType: audit.targetType,
      targetId: audit.targetId,
      metadataJsonb: audit.metadata,
    })
    .returning({ id: opsAuditEvents.id });
  if (!row) throw new Error("Partner audit insert failed.");
}

function toPartnerValues(partner: Partner, timestamp: Date) {
  return {
    key: partner.key,
    hosts: partner.hosts,
    categories: partner.categories,
    cities: partner.cities,
    trackingParam: partner.trackingParam,
    status: partner.status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function parsePartner(row: typeof partners.$inferSelect): Partner {
  const parsed = PartnerSchema.safeParse({
    key: row.key,
    hosts: row.hosts,
    categories: row.categories,
    cities: row.cities,
    trackingParam: row.trackingParam,
    status: row.status,
  });
  if (!parsed.success) throw new Error("Stored partner configuration is invalid.");
  return parsed.data;
}

function assertHostsAvailable(existing: Partner[], candidate: Partner): void {
  const candidateHosts = new Set(candidate.hosts);
  for (const partner of existing) {
    if (partner.key === candidate.key) continue;
    if (partner.hosts.some((host) => candidateHosts.has(host))) {
      throw new PartnerConfigurationConflictError("A partner host is already assigned.");
    }
  }
}
