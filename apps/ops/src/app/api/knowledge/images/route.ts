import { handlePoiImageDelete, handlePoiImageUpload, handlePoiImagesGet } from "./handler";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handlePoiImagesGet(request);
}

export async function POST(request: Request) {
  return handlePoiImageUpload(request);
}

export async function DELETE(request: Request) {
  return handlePoiImageDelete(request);
}
