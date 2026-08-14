import type { IncomingMessage, ServerResponse } from "node:http";
import type { PreparedBrowserAsset } from "./contracts.js";
import { browserAssetForRequest } from "./browserAssets.js";
import { htmlForBrowserRequest, redirectForBrowserRequest } from "./browserRoutes.js";
import {
  writeBrowserAssetResponse,
  writeBrowserRedirectResponse,
  writeHtmlResponse,
} from "./browserResponses.js";

export const handleBrowserRequest = (
  request: IncomingMessage,
  response: ServerResponse,
  appHtml: string | undefined,
  browserAssets: ReadonlyMap<string, PreparedBrowserAsset> | undefined,
): boolean => {
  const redirect = redirectForBrowserRequest(request);
  if (redirect !== undefined) {
    writeBrowserRedirectResponse(response, redirect);
    return true;
  }
  const asset = browserAssetForRequest(request, browserAssets);
  if (asset !== undefined) {
    writeBrowserAssetResponse(request, response, asset);
    return true;
  }
  const html = htmlForBrowserRequest(request, appHtml);
  if (html !== undefined) {
    writeHtmlResponse(response, html);
    return true;
  }
  return false;
};
