import type { YahooOAuthAuthorizeOptions } from "./contracts.js";

export const yahooAuthorizationEndpoint = "https://api.login.yahoo.com/oauth2/request_auth";
export const yahooTokenEndpoint = "https://api.login.yahoo.com/oauth2/get_token";
export const yahooFantasyReadScope = "fspt-r";

export const yahooOAuthAuthorizeUrl = ({
  clientId,
  redirectUri,
  state,
  scope = yahooFantasyReadScope,
}: YahooOAuthAuthorizeOptions): string => {
  const url = new URL(yahooAuthorizationEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  return url.toString();
};
