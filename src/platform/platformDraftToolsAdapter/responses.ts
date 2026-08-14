import type { ServerResponse } from "node:http";

export const securityHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export const authRequiredBody = {
  error: { code: "auth_required", message: "Sign in to continue." },
};

export const seasonRequiredBody = {
  error: {
    code: "season_required",
    message: "Choose a valid league season before opening draft tools.",
  },
};

export const membershipRequiredBody = {
  error: {
    code: "membership_required",
    message: "Join this league before opening its draft tools.",
  },
};

export const draftToolsUnavailableBody = {
  error: {
    code: "draft_tools_unavailable",
    message: "Draft tools are not available for this league yet.",
  },
};

export const internalErrorBody = {
  error: { code: "internal_error", message: "Something went wrong." },
};

export const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  if (response.writableEnded) return;

  const encodedBody = JSON.stringify(body);
  response.writeHead(statusCode, {
    ...securityHeaders,
    "content-length": Buffer.byteLength(encodedBody),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(encodedBody);
};
