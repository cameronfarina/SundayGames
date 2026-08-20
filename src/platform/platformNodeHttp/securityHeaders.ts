import type { IncomingMessage, ServerResponse } from "node:http";
import { isSecureRequest } from "./proxyTrust.js";

const defaultSecurityHeaders = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const htmlSecurityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "script-src 'self'",
    // Radix popovers inject a scroll-lock <style> element when they open, so
    // style ELEMENTS need 'unsafe-inline' alongside style attributes.
    "style-src 'self' 'unsafe-inline'", "style-src-attr 'unsafe-inline'", "img-src 'self' data: blob:",
    "font-src 'self'", "connect-src 'self'", "form-action 'self'",
    "frame-ancestors 'none'", "manifest-src 'self'", "worker-src 'self' blob:",
  ].join("; "),
  "Permissions-Policy": [
    "camera=()", "display-capture=()", "geolocation=()", "microphone=()",
    "payment=()", "usb=()",
  ].join(", "),
  "X-Frame-Options": "DENY",
};

export const setDefaultSecurityHeaders = (response: ServerResponse): void => {
  for (const [name, value] of Object.entries(defaultSecurityHeaders)) {
    if (!response.hasHeader(name)) response.setHeader(name, value);
  }
};

export const setHtmlSecurityHeaders = (response: ServerResponse): void => {
  setDefaultSecurityHeaders(response);
  for (const [name, value] of Object.entries(htmlSecurityHeaders)) {
    if (!response.hasHeader(name)) response.setHeader(name, value);
  }
};

const cacheControlPreventsStorage = (response: ServerResponse): boolean => {
  const cacheControl = response.getHeader("Cache-Control");
  if (typeof cacheControl === "string") {
    return cacheControl.split(",").some(directive => directive.trim().toLowerCase() === "no-store");
  }
  if (Array.isArray(cacheControl)) {
    return cacheControl.some(value => value.split(",")
      .some(directive => directive.trim().toLowerCase() === "no-store"));
  }
  return false;
};

export const setPrivateNoStoreCacheControl = (response: ServerResponse): void => {
  if (!cacheControlPreventsStorage(response)) {
    response.setHeader("Cache-Control", "private, no-store");
  }
};

export const setTransportSecurityHeader = (
  request: IncomingMessage,
  response: ServerResponse,
  trustProxy: boolean,
): void => {
  if (isSecureRequest(request, trustProxy) && !response.hasHeader("Strict-Transport-Security")) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
};
