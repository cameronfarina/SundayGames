import type { FantasyProsRepository, FantasyProsStoredRanking } from "../../../fantasyPros.js";
import {
  buildFantasyProsDraftAdvisory,
  type FantasyProsAdvisoryBasis,
} from "../../../fantasyProsAdvisory.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { methodNotAllowed } from "../../responses.js";

interface AdvisoryRankings {
  basis: FantasyProsAdvisoryBasis;
  rankings: readonly FantasyProsStoredRanking[];
}

// Rest-of-season is the basis a draft is decided on, and it is the only set
// that covers every position: the weekly set ranks flex players alone.
const rankingsFor = async (repository: FantasyProsRepository): Promise<AdvisoryRankings> => {
  const restOfSeason = await repository.rankings({ rankingType: "ros" });
  if (restOfSeason.length > 0) return { basis: "ros", rankings: restOfSeason };
  return { basis: "weekly", rankings: await repository.rankings({ rankingType: "weekly" }) };
};

const darkAdvisory = { basis: "ros", configured: false, players: [], week: null };

export const routeLiveRoomAdvisory = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  roomId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  // Reading the room authorizes the caller against the league before any
  // FantasyPros row is touched.
  const room = await app.getLiveDraftRoom({
    actorSessionToken: request.sessionToken,
    roomId,
    now: request.now,
  });
  const repository = services.fantasyProsRepository;
  if (repository === undefined || services.fantasyProsConfigured !== true) {
    return { status: 200, body: darkAdvisory };
  }
  const { basis, rankings } = await rankingsFor(repository);
  const advisory = buildFantasyProsDraftAdvisory({
    basis,
    candidates: room.playerCatalog,
    rankings,
  });
  return {
    status: 200,
    body: {
      configured: true,
      basis: advisory.basis,
      week: advisory.week ?? null,
      players: advisory.players,
    },
  };
};
