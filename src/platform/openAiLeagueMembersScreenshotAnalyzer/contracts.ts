import type { LeagueMembersScreenshotImportInput } from "../leagueMembersScreenshotImport.js";

export type LeagueMembersScreenshotAnalyzerErrorCode =
  | "invalid_image"
  | "provider_unavailable"
  | "provider_response_invalid";

export interface LeagueMembersScreenshotImageInput {
  mimeType: string;
  base64: string;
}

export interface LeagueMembersScreenshotAnalyzer {
  analyze(input: LeagueMembersScreenshotImageInput): Promise<LeagueMembersScreenshotImportInput>;
}

export interface CreateOpenAiLeagueMembersScreenshotAnalyzerOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  timeoutMs?: number;
  maxImageBytes?: number;
  maxConcurrentRequests?: number;
  fetchImpl?: typeof fetch;
}

export interface ValidateLeagueMembersScreenshotImageOptions {
  maxImageBytes: number;
}
