import { TRPCError } from "@trpc/server";

export function requireService<Service>(service: Service | undefined, capability: string): Service {
  if (service) return service;

  throw new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: `${capability} is unavailable.`,
  });
}
