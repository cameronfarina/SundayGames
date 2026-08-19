import type { FantasyProsRepository, FantasyProsStoredRanking } from "../../../fantasyPros.js";
import {
  buildFantasyProsDraftAdvisory,
  type FantasyProsAdvisoryBasis,
} from "../../../fantasyProsAdvisory.js";
import {
  emptyFantasyProsPlayerNewsIndex,
  loadFantasyProsPlayerNewsIndex,
  type FantasyProsPlayerNewsIndex,
} from "../../../fantasyProsInSeason.js";
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

// One seven-day read per request, joined against every ranked player at once.
// The room fetches its advisory on page load and holds it for five minutes, so
// there is no interval here to cache against.
const newsFor = async (
  services: PlatformHttpServices,
  now: Date | undefined,
): Promise<FantasyProsPlayerNewsIndex> => {
  const repository = services.playerNewsRepository;
  if (repository === undefined) return emptyFantasyProsPlayerNewsIndex();
  return await loadFantasyProsPlayerNewsIndex(repository, now);
};

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
  const [{ basis, rankings }, news] = await Promise.all([
    rankingsFor(repository),
    newsFor(services, request.now),
  ]);
  const advisory = buildFantasyProsDraftAdvisory({
    basis,
    candidates: room.playerCatalog,
    news,
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
