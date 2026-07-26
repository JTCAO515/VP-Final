import { handlePartnerGet } from "../handler";

export async function GET(request: Request, context: { params: Promise<{ partnerKey: string }> }) {
  return handlePartnerGet(request, context);
}
