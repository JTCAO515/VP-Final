import { handleVisePodProvisioningToken } from "./handler";

export async function POST(request: Request) {
  return handleVisePodProvisioningToken(request);
}
