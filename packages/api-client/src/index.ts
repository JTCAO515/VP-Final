import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import type { AppRouter } from "@visepanda/app-server/router";

export type { AppRouter } from "@visepanda/app-server/router";

export function createApiClient(baseUrl: string): TRPCClient<AppRouter> {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl.replace(/\/$/, "")}/trpc`,
      }),
    ],
  });
}

export type ApiClient = TRPCClient<AppRouter>;
