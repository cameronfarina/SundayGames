import type { PlatformHttpRequest } from "../platformHttp.js";
import type { PlatformRuntime } from "./internalContracts.js";

export const accountForPreflight = async (
  runtime: PlatformRuntime,
  request: PlatformHttpRequest,
  now: Date | undefined,
) => request.sessionToken === undefined
  ? null
  : runtime.app.findAccountBySessionToken(request.sessionToken, now);

export const canManageSeason = async (
  runtime: PlatformRuntime,
  accountId: string,
  seasonId: string,
): Promise<"allowed" | "missing" | "denied"> => {
  const season = await runtime.leagueSetupRepository.findLeagueSeason(seasonId);
  if (season === null) return "missing";
  const membership = await runtime.leagueSetupRepository.findMembership(accountId, season.leagueId);
  return membership?.role === "owner" || membership?.role === "admin" ? "allowed" : "denied";
};
