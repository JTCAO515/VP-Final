import { PARTNERS, PartnerSchema, PartnerStatusSchema, type Partner } from "@visepanda/domain";
import { z } from "zod";
import type { OpsAccess } from "../opsAuthorization/service.js";

const PartnerConfigurationFieldsSchema = z
  .object({
    key: z.string(),
    hosts: z.array(z.string()),
    categories: z.array(z.string()),
    cities: z.array(z.string()),
    trackingParam: z.string(),
    kind: z.enum(["ota", "creator"]).optional(),
  })
  .strict();

export const PartnerConfigurationInputSchema = PartnerConfigurationFieldsSchema.transform(
  (input, context): PartnerConfiguration => {
    const parsed = PartnerSchema.safeParse({ ...input, status: "pending" });
    if (!parsed.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      return z.NEVER;
    }
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(parsed.data.key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["key"],
        message: "Partner key must be a lowercase identifier",
      });
      return z.NEVER;
    }
    return configurationOf(parsed.data);
  },
);

export const PartnerStatusChangeInputSchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    status: PartnerStatusSchema,
    confirmActivation: z.boolean().optional(),
  })
  .strict();

export type PartnerConfiguration = Omit<Partner, "status">;
export type PartnerConfigurationInput = z.input<typeof PartnerConfigurationInputSchema>;
export type PartnerStatusChangeInput = z.infer<typeof PartnerStatusChangeInputSchema>;
export type PartnerConfigurationField =
  "hosts" | "categories" | "cities" | "trackingParam" | "kind";

export type PartnerAuditInput =
  | {
      action: "partner.created" | "partner.updated";
      targetType: "partner";
      targetId: string;
      metadata: { changedFields: PartnerConfigurationField[] };
    }
  | {
      action: "partner.status.changed";
      targetType: "partner";
      targetId: string;
      metadata: {
        previousStatus: Partner["status"];
        currentStatus: Partner["status"];
      };
    };

export type PartnerAdministrationStore = {
  list(): Promise<Partner[]>;
  get(key: string): Promise<Partner | null>;
  create(input: { actorId: string; partner: Partner }): Promise<Partner>;
  updateConfiguration(input: {
    actorId: string;
    configuration: PartnerConfiguration;
  }): Promise<Partner>;
  changeStatus(input: {
    actorId: string;
    key: string;
    status: Partner["status"];
  }): Promise<Partner>;
};

export type PartnerAdministrationService = {
  listPartners(actor: OpsAccess): Promise<Partner[]>;
  getPartner(actor: OpsAccess, key: string): Promise<Partner>;
  createPartner(actor: OpsAccess, input: PartnerConfigurationInput): Promise<Partner>;
  updatePartner(actor: OpsAccess, input: PartnerConfigurationInput): Promise<Partner>;
  changePartnerStatus(actor: OpsAccess, input: PartnerStatusChangeInput): Promise<Partner>;
};

export class PartnerConfigurationConflictError extends Error {
  readonly code = "PARTNER_CONFIGURATION_CONFLICT";

  constructor(message = "The partner configuration conflicts with an existing partner.") {
    super(message);
    this.name = "PartnerConfigurationConflictError";
  }
}

export class PartnerConfigurationNotFoundError extends Error {
  readonly code = "PARTNER_CONFIGURATION_NOT_FOUND";

  constructor() {
    super("The partner configuration was not found.");
    this.name = "PartnerConfigurationNotFoundError";
  }
}

export class PartnerActivationConfirmationError extends Error {
  readonly code = "PARTNER_ACTIVATION_CONFIRMATION_REQUIRED";

  constructor() {
    super("Activating a partner requires explicit confirmation.");
    this.name = "PartnerActivationConfirmationError";
  }
}

export class PartnerAdministrationForbiddenError extends Error {
  readonly code = "PARTNER_ADMINISTRATION_FORBIDDEN";

  constructor() {
    super("Admin partner permission is required.");
    this.name = "PartnerAdministrationForbiddenError";
  }
}

export function createPartnerAdministrationService(
  store: PartnerAdministrationStore,
): PartnerAdministrationService {
  return {
    async listPartners(actor) {
      requirePartnerPermission(actor, "partner.read");
      return store.list();
    },
    async getPartner(actor, key) {
      requirePartnerPermission(actor, "partner.read");
      const parsedKey = z.string().trim().min(1).max(64).parse(key);
      const partner = await store.get(parsedKey);
      if (!partner) throw new PartnerConfigurationNotFoundError();
      return partner;
    },
    async createPartner(actor, input) {
      requirePartnerPermission(actor, "partner.write");
      const configuration = PartnerConfigurationInputSchema.parse(input);
      const partner = PartnerSchema.parse({ ...configuration, status: "pending" });
      return store.create({
        actorId: actor.userId,
        partner,
      });
    },
    async updatePartner(actor, input) {
      requirePartnerPermission(actor, "partner.write");
      const configuration = PartnerConfigurationInputSchema.parse(input);
      return store.updateConfiguration({
        actorId: actor.userId,
        configuration,
      });
    },
    async changePartnerStatus(actor, input) {
      requirePartnerPermission(actor, "partner.write");
      const parsed = PartnerStatusChangeInputSchema.parse(input);
      if (parsed.status === "active" && parsed.confirmActivation !== true) {
        throw new PartnerActivationConfirmationError();
      }
      return store.changeStatus({
        actorId: actor.userId,
        key: parsed.key,
        status: parsed.status,
      });
    },
  };
}

export function createInMemoryPartnerAdministrationService(
  options: {
    seed?: Partner[];
    onAudit?: (audit: PartnerAuditInput) => void;
  } = {},
): PartnerAdministrationService {
  const records = new Map(
    (options.seed ?? PARTNERS).map((partner) => {
      const parsed = PartnerSchema.parse(partner);
      return [parsed.key, parsed] as const;
    }),
  );
  const store: PartnerAdministrationStore = {
    async list() {
      return [...records.values()]
        .map((partner) => structuredClone(partner))
        .sort((left, right) => left.key.localeCompare(right.key));
    },
    async get(key) {
      const partner = records.get(key);
      return partner ? structuredClone(partner) : null;
    },
    async create(input) {
      if (records.has(input.partner.key)) throw new PartnerConfigurationConflictError();
      assertHostsAvailable(records.values(), input.partner);
      records.set(input.partner.key, structuredClone(input.partner));
      options.onAudit?.(partnerCreatedAudit(input.partner));
      return structuredClone(input.partner);
    },
    async updateConfiguration(input) {
      const current = records.get(input.configuration.key);
      if (!current) throw new PartnerConfigurationNotFoundError();
      const partner = PartnerSchema.parse({ ...input.configuration, status: current.status });
      assertHostsAvailable(records.values(), partner);
      records.set(partner.key, structuredClone(partner));
      options.onAudit?.(partnerUpdatedAudit(current, input.configuration));
      return structuredClone(partner);
    },
    async changeStatus(input) {
      const current = records.get(input.key);
      if (!current) throw new PartnerConfigurationNotFoundError();
      if (current.status === input.status) {
        throw new PartnerConfigurationConflictError("The partner already has that status.");
      }
      const partner = PartnerSchema.parse({ ...current, status: input.status });
      records.set(partner.key, structuredClone(partner));
      options.onAudit?.(partnerStatusAudit(current, input.status));
      return structuredClone(partner);
    },
  };
  return createPartnerAdministrationService(store);
}

function requirePartnerPermission(actor: OpsAccess, permission: "partner.read" | "partner.write") {
  if (actor.role !== "admin" || !actor.permissions.includes(permission)) {
    throw new PartnerAdministrationForbiddenError();
  }
}

function configurationOf(partner: Partner): PartnerConfiguration {
  return {
    key: partner.key,
    hosts: [...partner.hosts],
    categories: [...partner.categories],
    cities: [...partner.cities],
    trackingParam: partner.trackingParam,
    kind: partner.kind,
  };
}

const configurationFields: PartnerConfigurationField[] = [
  "hosts",
  "categories",
  "cities",
  "trackingParam",
  "kind",
];

function changedConfigurationFields(
  current: Partner,
  configuration: PartnerConfiguration,
): PartnerConfigurationField[] {
  return configurationFields.filter((field) => {
    if (field === "trackingParam") return current.trackingParam !== configuration.trackingParam;
    return JSON.stringify(current[field]) !== JSON.stringify(configuration[field]);
  });
}

export function partnerCreatedAudit(partner: Partner): PartnerAuditInput {
  return {
    action: "partner.created",
    targetType: "partner",
    targetId: partner.key,
    metadata: { changedFields: [...configurationFields] },
  };
}

export function partnerUpdatedAudit(
  current: Partner,
  configuration: PartnerConfiguration,
): PartnerAuditInput {
  return {
    action: "partner.updated",
    targetType: "partner",
    targetId: configuration.key,
    metadata: { changedFields: changedConfigurationFields(current, configuration) },
  };
}

export function partnerStatusAudit(current: Partner, status: Partner["status"]): PartnerAuditInput {
  return {
    action: "partner.status.changed",
    targetType: "partner",
    targetId: current.key,
    metadata: { previousStatus: current.status, currentStatus: status },
  };
}

function assertHostsAvailable(records: Iterable<Partner>, candidate: Partner): void {
  const candidateHosts = new Set(candidate.hosts);
  for (const partner of records) {
    if (partner.key === candidate.key) continue;
    if (partner.hosts.some((host) => candidateHosts.has(host))) {
      throw new PartnerConfigurationConflictError("A partner host is already assigned.");
    }
  }
}
