import { LeagueSyncError, type LeagueSyncFetch, type LeagueSyncRequestOptions } from "./contracts.js";

export const defaultLeagueSyncTimeoutMs = 10_000;

interface LeagueSyncJsonRequest extends LeagueSyncRequestOptions {
  headers?: Record<string, string> | undefined;
  providerLabel: string;
  url: string;
}

const requestFetcher = (fetcher: LeagueSyncFetch | undefined): LeagueSyncFetch =>
  fetcher ?? ((url, init) => fetch(url, init));

/**
 * Providers answer with a status long before they answer with a body, so the
 * status is classified first. Anything unclassified stays "unreachable" rather
 * than being reported to the owner as a credential problem they cannot fix.
 */
const errorForStatus = (status: number, providerLabel: string): LeagueSyncError => {
  if (status === 401 || status === 403) {
    return new LeagueSyncError(
      "credentials_rejected",
      `${providerLabel} refused this request. The league is private or the saved sign-in details no longer work.`,
    );
  }
  if (status === 404) {
    return new LeagueSyncError("league_not_found", `${providerLabel} has no league with that ID.`);
  }
  return new LeagueSyncError(
    "provider_unreachable",
    `${providerLabel} answered with ${status}. Try syncing again in a few minutes.`,
  );
};

export const fetchLeagueSyncJson = async (request: LeagueSyncJsonRequest): Promise<unknown> => {
  // Without a deadline a stalled provider holds the owner's sync open forever.
  let response: Response;
  try {
    response = await requestFetcher(request.fetcher)(request.url, {
      headers: { accept: "application/json", ...request.headers },
      signal: AbortSignal.timeout(request.timeoutMs ?? defaultLeagueSyncTimeoutMs),
    });
  } catch {
    throw new LeagueSyncError(
      "provider_unreachable",
      `${request.providerLabel} did not respond. Try syncing again in a few minutes.`,
    );
  }

  if (!response.ok) throw errorForStatus(response.status, request.providerLabel);

  try {
    return await response.json();
  } catch {
    throw new LeagueSyncError(
      "provider_response_invalid",
      `${request.providerLabel} sent a response this app could not read.`,
    );
  }
};
