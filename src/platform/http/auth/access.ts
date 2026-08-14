import { PlatformAppError } from "../../platformApp.js";
import type { PlatformApp } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";

export const requireRequestAccount = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
) => {
  const account = await app.findAccountBySessionToken(request.sessionToken, request.now);
  if (account === null) throw new PlatformAppError("auth_required", "Sign in before using this workspace.");
  return account;
};

export const requireSeasonManager = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  seasonId: string,
) => {
  const account = await requireRequestAccount(app, request);
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  const membership = (await app.listLeagueMemberships(season.leagueId))
    .find(candidate => candidate.userId === account.id);
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    throw new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can manage league setup.",
    );
  }
  return account;
};
