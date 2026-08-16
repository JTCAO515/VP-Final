import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  OPS_POI_IMAGE_MAX_DIMENSION,
  PoiImageInputError,
  hasSupportedImageSignature,
  processPoiImage,
} from "./imageProcessor";

describe("Ops POI image processor", () => {
  it("rejects a file whose bytes do not declare a supported image format", async () => {
    await expect(processPoiImage(new Uint8Array([0x52, 0x49, 0x46, 0x46]))).rejects.toBeInstanceOf(
      PoiImageInputError,
    );
    expect(hasSupportedImageSignature(new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
  });

  it("re-encodes a signed JPEG as WebP without EXIF metadata", async () => {
    const source = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 180, g: 20, b: 30 } },
    })
      .withMetadata({ exif: { IFD0: { Copyright: "private-source" } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(source).metadata()).exif).toBeDefined();

    const processed = await processPoiImage(source);
    const metadata = await sharp(processed.bytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(processed).toMatchObject({ width: 8, height: 8 });
  });

  it("rejects an image whose single dimension exceeds the editorial ceiling", async () => {
    const source = await sharp({
      create: {
        width: OPS_POI_IMAGE_MAX_DIMENSION + 1,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();
    await expect(processPoiImage(source)).rejects.toThrow("dimensions");
  });
});
