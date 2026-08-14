import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  leagueSyncProviderStatuses,
  yahooFantasyReadScope,
  yahooOAuthAuthorizeUrl,
  yahooTokenEndpoint,
  type LeagueSyncProviderStatusReport,
} from "../../modeling/leagueSync.js";
import { defaultDraftApiPort } from "../constants.js";

interface YahooOAuthState {
  provider: "yahoo";
  createdAt: string;
  redirectUri: string;
}

const states = new Map<string, YahooOAuthState>();

const originFor = (request: IncomingMessage): string => {
  const forwarded = request.headers["x-forwarded-proto"];
  const protocol = (Array.isArray(forwarded) ? forwarded[0] : forwarded) || "http";
  return `${protocol}://${request.headers.host ?? `127.0.0.1:${defaultDraftApiPort}`}`;
};

const providerStatus = (): LeagueSyncProviderStatusReport => {
  const provider = leagueSyncProviderStatuses().find(item => item.key === "yahoo");
  if (!provider) throw new Error("Yahoo sync provider is not configured.");
  return provider;
};

export const yahooOAuthStartResponse = (request: IncomingMessage): unknown => {
  const provider = providerStatus();
  const requiredEnv = provider.auth.requiredEnv;
  const missingEnv = requiredEnv.filter(key => !process.env[key]?.trim());
  if (missingEnv.length > 0) {
    return {
      provider: "yahoo",
      readOnly: true,
      error: `Missing ${missingEnv.join(", ")} for Yahoo OAuth.`,
      requiredEnv,
      setupSteps: provider.setupSteps,
    };
  }

  const redirectUri = process.env.MOCKD_YAHOO_REDIRECT_URI?.trim() ||
    `${originFor(request)}/api/sync/oauth/yahoo/callback`;
  const state = randomUUID();
  states.set(state, { provider: "yahoo", createdAt: new Date().toISOString(), redirectUri });
  return {
    provider: "yahoo",
    readOnly: true,
    authorizationUrl: yahooOAuthAuthorizeUrl({
      clientId: process.env.MOCKD_YAHOO_CLIENT_ID?.trim() ?? "",
      redirectUri,
      state,
    }),
    redirectUri,
    state,
    scope: yahooFantasyReadScope,
  };
};

export const yahooOAuthCallbackResponse = (
  url: URL,
): { statusCode: number; body: unknown } => {
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return {
      statusCode: 400,
      body: {
        provider: "yahoo",
        readOnly: true,
        error: providerError,
        detail: url.searchParams.get("error_description") ?? "Yahoo did not authorize access.",
      },
    };
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return {
      statusCode: 400,
      body: { provider: "yahoo", readOnly: true, error: "Yahoo OAuth callback requires code and state." },
    };
  }
  const savedState = states.get(state);
  if (!savedState) {
    return {
      statusCode: 400,
      body: {
        provider: "yahoo",
        readOnly: true,
        error: "Yahoo OAuth state was not recognized. Start the connect flow again.",
      },
    };
  }
  states.delete(state);
  return {
    statusCode: 200,
    body: {
      provider: "yahoo",
      readOnly: true,
      status: "authorization-code-received",
      redirectUri: savedState.redirectUri,
      tokenEndpoint: yahooTokenEndpoint,
      nextStep: "Exchange this code server-side, encrypt refresh/access tokens at rest, then enable read-only Yahoo league sync.",
    },
  };
};
