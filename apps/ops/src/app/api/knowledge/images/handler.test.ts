import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PoiImageService } from "@visepanda/app-server";
import type { PoiImage } from "@visepanda/domain";
import { handlePoiImageDelete, handlePoiImageUpload, handlePoiImagesGet } from "./handler";
import { PoiImageInputError, type ProcessedPoiImage } from "./imageProcessor";
import type { PoiImageStorageGateway } from "./storage";

const actorId = "30000000-0000-4000-8000-000000000021";
const imageId = "30000000-0000-4000-8000-000000000001";
const image: PoiImage = {
  id: imageId,
  target: { kind: "city", city: "Shanghai" },
  storagePath: "editorial/30000000-0000-4000-8000-000000000002.webp",
  contentType: "image/webp",
  byteSize: 10,
  width: 2,
  height: 2,
  attribution: "Example photographer",
  licenseNote: "Licensed editorial use",
  createdBy: actorId,
  createdAt: "2026-08-16T00:00:00.000Z",
  deletedAt: null,
};

describe("Ops POI image route", () => {
  const authorize = vi.fn();
  const listActive = vi.fn();
  const getActive = vi.fn();
  const create = vi.fn();
  const revoke = vi.fn();
  const upload = vi.fn();
  const remove = vi.fn();
  const process = vi.fn<(bytes: Uint8Array) => Promise<ProcessedPoiImage>>();

  const dependencies = () => ({
    authorize,
    getImageService: () =>
      ({ listActive, getActive, create, revoke }) as unknown as PoiImageService,
    getStorage: () => ({ upload, remove }) as PoiImageStorageGateway,
    process,
    generatePath: () => image.storagePath,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockResolvedValue({
      access: {
        userId: actorId,
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      },
      authorizationService: {},
      cookieResponse: new NextResponse(),
    });
    listActive.mockResolvedValue([image]);
    getActive.mockResolvedValue(image);
    create.mockResolvedValue(image);
    revoke.mockResolvedValue({ ...image, deletedAt: "2026-08-16T01:00:00.000Z" });
    process.mockResolvedValue({ bytes: new Uint8Array([1, 2]), byteSize: 2, width: 1, height: 1 });
  });

  it("authorizes before parsing an upload body or touching storage", async () => {
    authorize.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const response = await handlePoiImageUpload(uploadRequest(), dependencies());
    expect(response.status).toBe(403);
    expect(process).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("rejects missing attribution before image processing or storage", async () => {
    const response = await handlePoiImageUpload(uploadRequest({ attribution: "" }), dependencies());
    expect(response.status).toBe(400);
    expect(process).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("stores only processed WebP metadata after authorized upload", async () => {
    const response = await handlePoiImageUpload(uploadRequest(), dependencies());
    expect(response.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(image.storagePath, new Uint8Array([1, 2]));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId,
        storagePath: image.storagePath,
        target: { kind: "city", city: "Shanghai" },
        byteSize: 2,
      }),
    );
    const payload = await response.json();
    expect(payload.image).not.toHaveProperty("publicUrl");
  });

  it("cleans up the private object and reports failure when the metadata/audit write fails", async () => {
    create.mockRejectedValue(new Error("audit failed"));
    const response = await handlePoiImageUpload(uploadRequest(), dependencies());
    expect(response.status).toBe(503);
    expect(remove).toHaveBeenCalledWith(image.storagePath);
  });

  it("rejects invalid image headers without storage writes", async () => {
    process.mockRejectedValue(
      new PoiImageInputError("Only JPEG, PNG, or WebP image files are supported."),
    );
    const response = await handlePoiImageUpload(uploadRequest(), dependencies());
    expect(response.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });

  it("requires authorization before listing private metadata", async () => {
    authorize.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    const response = await handlePoiImagesGet(
      new Request("https://ops.example/images"),
      dependencies(),
    );
    expect(response.status).toBe(403);
    expect(listActive).not.toHaveBeenCalled();
  });

  it("deletes a private object before atomically revoking its metadata", async () => {
    const response = await handlePoiImageDelete(deleteRequest(), dependencies());
    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith(image.storagePath);
    expect(revoke).toHaveBeenCalledWith({ imageId, actorId });
  });
});

function uploadRequest(overrides: { attribution?: string } = {}) {
  const form = new FormData();
  form.set("targetKind", "city");
  form.set("city", "Shanghai");
  form.set("attribution", overrides.attribution ?? "Example photographer");
  form.set("licenseNote", "Licensed editorial use");
  form.set(
    "file",
    new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
    "ignored.jpg",
  );
  return new Request("https://ops.example/images", { method: "POST", body: form });
}

function deleteRequest() {
  return new Request("https://ops.example/images", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageId }),
  });
}
