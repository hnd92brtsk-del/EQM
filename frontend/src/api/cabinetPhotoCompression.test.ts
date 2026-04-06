import { describe, expect, it, vi } from "vitest";

import {
  CABINET_PHOTO_SERVER_LIMIT_BYTES,
  CABINET_PHOTO_TARGET_BYTES,
  CabinetPhotoCompressionError,
  compressCabinetPhotoForUpload
} from "./cabinetPhotoCompression";

describe("compressCabinetPhotoForUpload", () => {
  it("returns the original jpeg when it is already under the target size", async () => {
    const file = new File([new Uint8Array(100_000)], "cabinet.jpg", { type: "image/jpeg" });

    const result = await compressCabinetPhotoForUpload(file, {
      readDimensions: vi.fn(),
      renderJpeg: vi.fn()
    });

    expect(result).toBe(file);
  });

  it("compresses a large image to jpeg under the target size", async () => {
    const file = new File([new Uint8Array(CABINET_PHOTO_SERVER_LIMIT_BYTES + 500_000)], "cabinet.png", {
      type: "image/png"
    });
    const renderJpeg = vi
      .fn()
      .mockResolvedValueOnce(new Blob([new Uint8Array(2_400_000)], { type: "image/jpeg" }))
      .mockResolvedValueOnce(new Blob([new Uint8Array(1_500_000)], { type: "image/jpeg" }));

    const result = await compressCabinetPhotoForUpload(file, {
      readDimensions: vi.fn().mockResolvedValue({ width: 4200, height: 2800 }),
      renderJpeg
    });

    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("cabinet.jpg");
    expect(result.size).toBeLessThanOrEqual(CABINET_PHOTO_TARGET_BYTES);
    expect(renderJpeg).toHaveBeenCalled();
  });

  it("falls back to the server limit when the target is missed but the hard limit is respected", async () => {
    const file = new File([new Uint8Array(CABINET_PHOTO_SERVER_LIMIT_BYTES + 500_000)], "cabinet.png", {
      type: "image/png"
    });
    const renderJpeg = vi.fn().mockResolvedValue(new Blob([new Uint8Array(1_950_000)], { type: "image/jpeg" }));

    const result = await compressCabinetPhotoForUpload(file, {
      readDimensions: vi.fn().mockResolvedValue({ width: 4200, height: 2800 }),
      renderJpeg
    });

    expect(result.type).toBe("image/jpeg");
    expect(result.size).toBeLessThanOrEqual(CABINET_PHOTO_SERVER_LIMIT_BYTES);
  });

  it("throws a readable error when the image is still too large after compression", async () => {
    const file = new File([new Uint8Array(CABINET_PHOTO_SERVER_LIMIT_BYTES + 500_000)], "cabinet.png", {
      type: "image/png"
    });

    await expect(
      compressCabinetPhotoForUpload(file, {
        readDimensions: vi.fn().mockResolvedValue({ width: 4200, height: 2800 }),
        renderJpeg: vi.fn().mockResolvedValue(new Blob([new Uint8Array(2_600_000)], { type: "image/jpeg" }))
      })
    ).rejects.toMatchObject({
      name: "PhotoCompressionError",
      reason: "too_large_after_compression"
    } satisfies Partial<CabinetPhotoCompressionError>);
  });
});
