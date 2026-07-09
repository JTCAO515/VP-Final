import { initTRPC } from "@trpc/server";
import type { ServerContext } from "./context.js";

const t = initTRPC.context<ServerContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
