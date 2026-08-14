import type { IncomingMessage } from "node:http";

const pathnameFor = (request: IncomingMessage): string | undefined => {
  try {
    return new URL(request.url ?? "/", "http://mockd.local").pathname;
  } catch {
    return undefined;
  }
};

export const isScreenshotImportAnalysisRequest = (request: IncomingMessage): boolean => {
  if (request.method?.toUpperCase() !== "POST") return false;
  const pathname = pathnameFor(request);
  return pathname !== undefined
    && (/^\/seasons\/[^/]+\/setup-import\/screenshot-analyze$/u.test(pathname)
      || pathname === "/league-imports/espn/members-screenshot-review");
};

export const isHistoricalSpreadsheetUploadRequest = (request: IncomingMessage): boolean => {
  if (request.method?.toUpperCase() !== "POST") return false;
  const pathname = pathnameFor(request);
  return pathname !== undefined
    && /^\/seasons\/[^/]+\/historical-imports\/upload-preview$/u.test(pathname);
};

export const isHistoricalImportPreviewRequest = (request: IncomingMessage): boolean => {
  if (request.method?.toUpperCase() !== "POST") return false;
  const pathname = pathnameFor(request);
  return pathname !== undefined
    && /^\/seasons\/[^/]+\/historical-imports\/(?:preview|upload-preview)$/u.test(pathname);
};

export const bodyLimitForRequest = (
  request: IncomingMessage,
  defaultLimit: number,
  screenshotImportLimit: number,
): number => isScreenshotImportAnalysisRequest(request)
  || isHistoricalSpreadsheetUploadRequest(request)
    ? screenshotImportLimit
    : defaultLimit;
