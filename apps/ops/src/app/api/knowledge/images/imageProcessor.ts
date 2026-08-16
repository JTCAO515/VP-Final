import sharp from "sharp";

export const OPS_POI_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const OPS_POI_IMAGE_MAX_DIMENSION = 4096;

export class PoiImageInputError extends Error {}

export type ProcessedPoiImage = {
  bytes: Uint8Array;
  byteSize: number;
  width: number;
  height: number;
};

/** Validates bytes rather than an untrusted filename/MIME, then emits a metadata-free WebP. */
export async function processPoiImage(source: Uint8Array): Promise<ProcessedPoiImage> {
  if (source.byteLength === 0 || source.byteLength > OPS_POI_IMAGE_MAX_BYTES) {
    throw new PoiImageInputError("Image files must be no larger than 5 MiB.");
  }
  if (!hasSupportedImageSignature(source)) {
    throw new PoiImageInputError("Only JPEG, PNG, or WebP image files are supported.");
  }

  try {
    const decoded = sharp(source, {
      animated: false,
      failOn: "error",
      limitInputPixels: OPS_POI_IMAGE_MAX_DIMENSION * OPS_POI_IMAGE_MAX_DIMENSION,
    });
    const metadata = await decoded.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > OPS_POI_IMAGE_MAX_DIMENSION ||
      metadata.height > OPS_POI_IMAGE_MAX_DIMENSION
    ) {
      throw new PoiImageInputError("Image dimensions must not exceed 4096 by 4096 pixels.");
    }

    // `withMetadata` is intentionally absent: re-encoding strips EXIF/GPS and client metadata.
    const output = await decoded.rotate().webp({ effort: 4, quality: 82 }).toBuffer();
    if (output.byteLength === 0 || output.byteLength > OPS_POI_IMAGE_MAX_BYTES) {
      throw new PoiImageInputError("Processed image files must be no larger than 5 MiB.");
    }
    const outputMetadata = await sharp(output, { animated: false }).metadata();
    if (!outputMetadata.width || !outputMetadata.height || outputMetadata.exif) {
      throw new PoiImageInputError("Image processing could not produce a safe editorial image.");
    }
    return {
      bytes: output,
      byteSize: output.byteLength,
      width: outputMetadata.width,
      height: outputMetadata.height,
    };
  } catch (error) {
    if (error instanceof PoiImageInputError) throw error;
    throw new PoiImageInputError("The image could not be decoded safely.");
  }
}

export function hasSupportedImageSignature(bytes: Uint8Array): boolean {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const webp =
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return jpeg || png || webp;
}
