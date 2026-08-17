import { type PoiImageService } from "@visepanda/app-server";
import { PoiImageUploadMetadataSchema } from "@visepanda/domain";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  applyOpsCookies,
  authorizeOpsRequest,
  isAuthorizedOpsRequest,
  type AuthorizedOpsRequest,
} from "../../../../lib/opsAccess";
import { getPoiImageService } from "../store";
import {
  OPS_POI_IMAGE_MAX_BYTES,
  PoiImageInputError,
  processPoiImage,
  type ProcessedPoiImage,
} from "./imageProcessor";
import { createPoiImageStorageGateway, type PoiImageStorageGateway } from "./storage";

type Dependencies = {
  authorize: (
    request: Request,
    permission: "knowledge.read" | "knowledge.write",
  ) => Promise<AuthorizedOpsRequest | NextResponse>;
  getImageService: () => PoiImageService;
  getStorage: () => PoiImageStorageGateway;
  process: (bytes: Uint8Array) => Promise<ProcessedPoiImage>;
  generatePath: () => string;
};

const defaultDependencies: Dependencies = {
  authorize: authorizeOpsRequest,
  getImageService: getPoiImageService,
  getStorage: createPoiImageStorageGateway,
  process: processPoiImage,
  generatePath: () => `editorial/${randomUUID()}.webp`,
};

export async function handlePoiImagesGet(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "knowledge.read");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  try {
    const images = await dependencies.getImageService().listActive();
    // Object paths are operational metadata, not public URLs. A public delivery path is not part of #442.
    return applyOpsCookies(NextResponse.json({ ok: true, images }), authorization.cookieResponse);
  } catch {
    return unavailable(authorization.cookieResponse);
  }
}

export async function handlePoiImageUpload(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;

  try {
    const form = await request.formData();
    const metadata = parseMetadata(form);
    const bytes = await fileBytes(form.get("file"));
    const processed = await dependencies.process(bytes);
    const storagePath = dependencies.generatePath();
    const storage = dependencies.getStorage();
    await storage.upload(storagePath, processed.bytes);
    try {
      const image = await dependencies.getImageService().create({
        ...metadata,
        actorId: authorization.access.userId,
        storagePath,
        byteSize: processed.byteSize,
        width: processed.width,
        height: processed.height,
      });
      return applyOpsCookies(
        NextResponse.json({ ok: true, image }, { status: 201 }),
        authorization.cookieResponse,
      );
    } catch {
      // A storage write without a metadata/audit transaction is not an accepted upload. Best-effort
      // cleanup cannot turn a failed write into success, and this private bucket has no public delivery.
      await storage.remove(storagePath).catch(() => undefined);
      return unavailable(authorization.cookieResponse);
    }
  } catch (error) {
    if (error instanceof PoiImageInputError) {
      return applyOpsCookies(
        NextResponse.json({ ok: false, error: error.message }, { status: 400 }),
        authorization.cookieResponse,
      );
    }
    return unavailable(authorization.cookieResponse);
  }
}

export async function handlePoiImageDelete(
  request: Request,
  dependencies: Dependencies = defaultDependencies,
) {
  const authorization = await dependencies.authorize(request, "knowledge.write");
  if (!isAuthorizedOpsRequest(authorization)) return authorization;
  let imageId: string;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.imageId !== "string" || !isUuid(body.imageId)) {
      throw new PoiImageInputError("需要有效的图片 ID。 ");
    }
    imageId = body.imageId;
  } catch (error) {
    return applyOpsCookies(
      NextResponse.json(
        {
          ok: false,
          error: error instanceof PoiImageInputError ? error.message : "需要有效的图片 ID。",
        },
        { status: 400 },
      ),
      authorization.cookieResponse,
    );
  }

  try {
    const image = await dependencies.getImageService().getActive(imageId);
    if (!image) {
      return applyOpsCookies(
        NextResponse.json({ ok: false, error: "未找到图片。" }, { status: 404 }),
        authorization.cookieResponse,
      );
    }
    // Storage is deleted before metadata revocation. If the subsequent audit transaction fails, the
    // request still fails closed; the only possible residue is a private missing object, never public media.
    await dependencies.getStorage().remove(image.storagePath);
    const revoked = await dependencies.getImageService().revoke({
      imageId,
      actorId: authorization.access.userId,
    });
    if (!revoked) return unavailable(authorization.cookieResponse);
    return applyOpsCookies(
      NextResponse.json({ ok: true, image: revoked }),
      authorization.cookieResponse,
    );
  } catch {
    return unavailable(authorization.cookieResponse);
  }
}

function parseMetadata(form: FormData) {
  const targetKind = stringField(form, "targetKind");
  const target =
    targetKind === "poi"
      ? { kind: "poi" as const, poiId: stringField(form, "poiId") }
      : targetKind === "city"
        ? { kind: "city" as const, city: stringField(form, "city") }
        : targetKind === "category"
          ? { kind: "category" as const, category: stringField(form, "category") }
          : null;
  const parsed = PoiImageUploadMetadataSchema.safeParse({
    target,
    attribution: stringField(form, "attribution"),
    licenseNote: stringField(form, "licenseNote"),
  });
  if (!parsed.success) throw new PoiImageInputError("必须填写图片目标、归属和授权说明。 ");
  return parsed.data;
}

async function fileBytes(value: FormDataEntryValue | null): Promise<Uint8Array> {
  if (!isFileLike(value) || value.size <= 0 || value.size > OPS_POI_IMAGE_MAX_BYTES) {
    throw new PoiImageInputError("需要不超过 5 MiB 的 JPEG、PNG 或 WebP 图片。 ");
  }
  return new Uint8Array(await value.arrayBuffer());
}

function stringField(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return typeof value === "object" && value !== null && "arrayBuffer" in value && "size" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function unavailable(cookies: NextResponse) {
  return applyOpsCookies(
    NextResponse.json(
      { ok: false, error: "Ops image storage is temporarily unavailable." },
      { status: 503 },
    ),
    cookies,
  );
}
