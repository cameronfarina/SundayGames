import type { PlatformInvitationRepository, PlatformInvitationView } from "./contracts.js";
import type { IssuePlatformInvitationOptions } from "./operationContracts.js";
import {
  derivePlatformLeagueInvitationToken,
  hashPlatformInvitationToken,
} from "./tokens.js";
import { publicInvitation } from "./views.js";

export const listPlatformInvitations = async (
  repository: PlatformInvitationRepository,
  seasonId: string,
  options: Pick<IssuePlatformInvitationOptions, "leagueTokenSecret"> = {},
): Promise<readonly PlatformInvitationView[]> =>
  (await repository.listForSeason(seasonId)).map(record => {
    const candidateToken =
      record.kind === "league" &&
      record.status === "pending" &&
      options.leagueTokenSecret !== undefined
        ? derivePlatformLeagueInvitationToken(record.id, options.leagueTokenSecret)
        : undefined;
    const token = candidateToken !== undefined &&
      hashPlatformInvitationToken(candidateToken) === record.tokenHash
      ? candidateToken
      : undefined;
    return publicInvitation(record, token);
  });
