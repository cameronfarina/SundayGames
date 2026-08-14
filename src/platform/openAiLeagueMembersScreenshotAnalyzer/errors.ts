import type { LeagueMembersScreenshotAnalyzerErrorCode } from "./contracts.js";

export class LeagueMembersScreenshotAnalyzerError extends Error {
  constructor(
    readonly code: LeagueMembersScreenshotAnalyzerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LeagueMembersScreenshotAnalyzerError";
  }
}
