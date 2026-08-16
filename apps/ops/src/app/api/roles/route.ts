import {
  handleMembershipAssignByExactEmail,
  handleMembershipList,
  handleMembershipRevoke,
  handleMembershipSet,
} from "./handler";

export async function GET(request: Request) {
  return handleMembershipList(request);
}

export async function PUT(request: Request) {
  return handleMembershipSet(request);
}

export async function POST(request: Request) {
  return handleMembershipAssignByExactEmail(request);
}

export async function DELETE(request: Request) {
  return handleMembershipRevoke(request);
}
