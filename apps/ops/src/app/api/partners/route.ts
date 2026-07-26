import {
  handlePartnerCreate,
  handlePartnerStatusChange,
  handlePartnerUpdate,
  handlePartnersGet,
} from "./handler";

export async function GET(request: Request) {
  return handlePartnersGet(request);
}

export async function POST(request: Request) {
  return handlePartnerCreate(request);
}

export async function PUT(request: Request) {
  return handlePartnerUpdate(request);
}

export async function PATCH(request: Request) {
  return handlePartnerStatusChange(request);
}
