import { handleVisePodUserResolve } from "./handler";

export async function POST(request: Request) {
  return handleVisePodUserResolve(request);
}
