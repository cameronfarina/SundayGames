import type { PlatformHttpRequest } from "../platformHttp.js";

export const pathSegmentsFor = (
  request: PlatformHttpRequest,
): readonly string[] | null => {
  try {
    return new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));
  } catch {
    return null;
  }
};
