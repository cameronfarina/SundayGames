import type { IncomingHttpHeaders, IncomingMessage } from "node:http";
import { isIP } from "node:net";
import { headerValue } from "./headers.js";

const isDirectSecureRequest = (request: IncomingMessage): boolean =>
  "encrypted" in request.socket && request.socket.encrypted === true;

const normalizedProtocol = (value: string): string => {
  const trimmed = value.trim();
  const unquoted = trimmed.startsWith("\"") && trimmed.endsWith("\"")
    ? trimmed.slice(1, -1)
    : trimmed;
  return unquoted.trim().toLowerCase();
};

const trustedForwardedProtocol = (headers: IncomingHttpHeaders): string | undefined => {
  const forwarded = headerValue(headers, "forwarded");
  if (forwarded !== undefined) {
    const firstHop = forwarded.split(",", 1)[0] ?? "";
    for (const parameter of firstHop.split(";")) {
      const separatorIndex = parameter.indexOf("=");
      if (separatorIndex === -1) continue;
      if (parameter.slice(0, separatorIndex).trim().toLowerCase() === "proto") {
        return normalizedProtocol(parameter.slice(separatorIndex + 1));
      }
    }
  }
  const xForwardedProto = headerValue(headers, "x-forwarded-proto");
  return xForwardedProto === undefined
    ? undefined
    : normalizedProtocol(xForwardedProto.split(",", 1)[0] ?? "");
};

export const isSecureRequest = (request: IncomingMessage, trustProxy: boolean): boolean =>
  isDirectSecureRequest(request)
  || (trustProxy && trustedForwardedProtocol(request.headers) === "https");

const validatedClientAddress = (rawAddress: string): string | undefined => {
  let address = rawAddress.trim();
  if (address.startsWith("\"") && address.endsWith("\"") && address.length >= 2) {
    address = address.slice(1, -1).trim();
  }
  const bracketedIpv6 = address.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6?.[1] !== undefined) {
    return isIP(bracketedIpv6[1]) === 6 ? bracketedIpv6[1] : undefined;
  }
  if (isIP(address) !== 0) return address;
  const ipv4WithPort = address.match(/^(.+):(\d+)$/);
  const ipv4Address = ipv4WithPort?.[1];
  return ipv4Address !== undefined && isIP(ipv4Address) === 4 ? ipv4Address : undefined;
};

const forwardedClientAddress = (headers: IncomingHttpHeaders): string | undefined => {
  const cloudflareConnectingIp = headerValue(headers, "cf-connecting-ip");
  if (cloudflareConnectingIp !== undefined) return validatedClientAddress(cloudflareConnectingIp);

  const forwarded = headerValue(headers, "forwarded");
  if (forwarded !== undefined) {
    const firstHop = forwarded.split(",", 1)[0] ?? "";
    const forParameter = firstHop.split(";").map(parameter => parameter.trim())
      .find(parameter => parameter.slice(0, parameter.indexOf("=")).trim().toLowerCase() === "for");
    const separatorIndex = forParameter?.indexOf("=") ?? -1;
    return separatorIndex >= 0
      ? validatedClientAddress(forParameter?.slice(separatorIndex + 1) ?? "")
      : undefined;
  }
  const xForwardedFor = headerValue(headers, "x-forwarded-for");
  if (xForwardedFor !== undefined) {
    return validatedClientAddress(xForwardedFor.split(",", 1)[0] ?? "");
  }
  const xRealIp = headerValue(headers, "x-real-ip");
  return xRealIp === undefined ? undefined : validatedClientAddress(xRealIp);
};

export const clientAddressFor = (
  request: IncomingMessage,
  trustProxy: boolean,
): string | undefined => trustProxy
  ? forwardedClientAddress(request.headers) ?? request.socket.remoteAddress
  : request.socket.remoteAddress;
