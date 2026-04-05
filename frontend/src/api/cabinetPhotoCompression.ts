export const CABINET_PHOTO_SERVER_LIMIT_BYTES = 2 * 1024 * 1024;
export const CABINET_PHOTO_TARGET_BYTES = Math.floor(1.8 * 1024 * 1024);
const MAX_DIMENSION = 1600;
const INITIAL_QUALITY = 0.82;
const MIN_QUALITY = 0.46;
const QUALITY_STEP = 0.08;
const MIN_SCALE = 0.35;
const SCALE_STEP = 0.85;

export class CabinetPhotoCompressionError extends Error {
  reason: "compress_failed" | "too_large_after_compression";

  constructor(reason: "compress_failed" | "too_large_after_compression", message: string) {
    super(message);
    this.name = "CabinetPhotoCompressionError";
    this.reason = reason;
  }
}

type ImageDimensions = {
  width: number;
  height: number;
};

type CompressionDeps = {
  readDimensions(file: File): Promise<ImageDimensions>;
  renderJpeg(file: File, width: number, height: number, quality: number): Promise<Blob>;
};

function replaceFileExtension(filename: string, extension: string) {
  const baseName = filename.replace(/\.[^.]+$/, "");
  return `${baseName || "cabinet-photo"}${extension}`;
}

async function readImageDimensions(file: File): Promise<ImageDimensions> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to decode image"));
      element.src = objectUrl;
    });
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function renderImageAsJpeg(
  file: File,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to decode image"));
      element.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });
    if (!blob) {
      throw new Error("Failed to encode image");
    }
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const browserCompressionDeps: CompressionDeps = {
  readDimensions: readImageDimensions,
  renderJpeg: renderImageAsJpeg
};

export async function compressCabinetPhotoForUpload(
  file: File,
  deps: CompressionDeps = browserCompressionDeps
): Promise<File> {
  if (file.size <= CABINET_PHOTO_TARGET_BYTES && file.type === "image/jpeg") {
    return file;
  }

  let dimensions: ImageDimensions;
  try {
    dimensions = await deps.readDimensions(file);
  } catch {
    throw new CabinetPhotoCompressionError(
      "compress_failed",
      "Failed to automatically compress the photo before upload"
    );
  }

  const longestSide = Math.max(dimensions.width, dimensions.height, 1);
  let scale = Math.min(1, MAX_DIMENSION / longestSide);
  let quality = INITIAL_QUALITY;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const width = Math.max(1, Math.round(dimensions.width * scale));
    const height = Math.max(1, Math.round(dimensions.height * scale));

    let blob: Blob;
    try {
      blob = await deps.renderJpeg(file, width, height, quality);
    } catch {
      throw new CabinetPhotoCompressionError(
        "compress_failed",
        "Failed to automatically compress the photo before upload"
      );
    }

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob;
    }

    if (blob.size <= CABINET_PHOTO_TARGET_BYTES) {
      return new File([blob], replaceFileExtension(file.name, ".jpg"), {
        type: "image/jpeg"
      });
    }

    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
      continue;
    }

    if (scale > MIN_SCALE) {
      scale = Math.max(MIN_SCALE, scale * SCALE_STEP);
      quality = INITIAL_QUALITY;
      continue;
    }

    break;
  }

  if (bestBlob && bestBlob.size <= CABINET_PHOTO_SERVER_LIMIT_BYTES) {
    return new File([bestBlob], replaceFileExtension(file.name, ".jpg"), {
      type: "image/jpeg"
    });
  }

  throw new CabinetPhotoCompressionError(
    "too_large_after_compression",
    "The photo is still too large after automatic compression"
  );
}
