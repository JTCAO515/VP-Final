import { handleAuditLedgerGet } from "./handler";

export async function GET(request: Request) {
  return handleAuditLedgerGet(request);
}
