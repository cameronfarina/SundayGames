import { Buffer } from "node:buffer";
import type {
  LeagueMembersScreenshotImageInput,
  ValidateLeagueMembersScreenshotImageOptions,
} from "./contracts.js";
import { LeagueMembersScreenshotAnalyzerError } from "./errors.js";

const supportedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

const imageMatchesMimeType = (bytes: Buffer, mimeType: string): boolean => {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return mimeType === "image/webp"
    && bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP";
};

const formattedByteLimit = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MB`;
  return `${Math.floor(bytes / 1024)} KB`;
};

export const validateLeagueMembersScreenshotImage = (
  input: LeagueMembersScreenshotImageInput,
  options: ValidateLeagueMembersScreenshotImageOptions,
): { mimeType: string; bytes: Buffer } => {
  const mimeType = input.mimeType.trim().toLowerCase();
  if (!supportedMimeTypes.has(mimeType)) {
    throw new LeagueMembersScreenshotAnalyzerError("invalid_image", "Choose a PNG, JPEG, or WebP screenshot.");
  }
  const base64 = input.base64.trim();
  if (base64.length === 0 || !/^[a-z0-9+/]+={0,2}$/iu.test(base64)) {
    throw new LeagueMembersScreenshotAnalyzerError("invalid_image", "The screenshot file is invalid.");
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > options.maxImageBytes) {
    throw new LeagueMembersScreenshotAnalyzerError(
      "invalid_image",
      `Screenshots must be ${formattedByteLimit(options.maxImageBytes)} or smaller.`,
    );
  }
  if (!imageMatchesMimeType(bytes, mimeType)) {
    throw new LeagueMembersScreenshotAnalyzerError(
      "invalid_image",
      "The file contents do not match the selected image type.",
    );
  }
  return { mimeType, bytes };
};
