import type { IncomingMessage } from "node:http";
import { appShellPaths, legacyProductRedirects } from "./constants.js";

export const htmlForBrowserRequest = (
  request: IncomingMessage,
  appHtml: string | undefined,
): string | undefined => {
  if (request.method !== "GET") return undefined;
  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    return appShellPaths.has(pathname) ? appHtml : undefined;
  } catch {
    return undefined;
  }
};

export const redirectForBrowserRequest = (request: IncomingMessage): string | undefined => {
  if (request.method !== "GET") return undefined;
  try {
    const source = new URL(request.url ?? "/", "http://mockd.local");
    const targetPath = legacyProductRedirects.get(source.pathname);
    if (targetPath === undefined) return undefined;
    const legacySeasonId = source.searchParams.get("contextSeasonId");
    if (legacySeasonId !== null && !source.searchParams.has("seasonId")) {
      source.searchParams.set("seasonId", legacySeasonId);
    }
    source.searchParams.delete("contextSeasonId");
    if (source.pathname === "/player-news") source.searchParams.set("view", "news");
    return `${targetPath}${source.search}`;
  } catch {
    return undefined;
  }
};
