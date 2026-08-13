import {
  handleVisePodBindingDelete,
  handleVisePodBindingGet,
  handleVisePodBindingPut,
} from "./handler";

type RouteContext = { params: Promise<{ deviceId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleVisePodBindingGet(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handleVisePodBindingPut(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleVisePodBindingDelete(request, context);
}
