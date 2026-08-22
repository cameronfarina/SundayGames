import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
import {
  normalizeLeagueSeason,
  type AnyLeagueSeason,
  type ExplicitLeagueSeason,
} from "../../../leagueSeason.js";
import type { LiveDraftRoomSetup } from "../../../liveDraftRoomSetups.js";
import { liveDraftRoomSetupContentHash } from "../../../liveDraftRoomSetups.js";
import { MockDraftSessionError } from "../../../mockSessions.js";
import type { MockDraftSession } from "../../../mockSessions.js";
import type { PlatformLeagueMembership } from "../../../platformApp.js";
import { PlatformAppError } from "../../../platformApp.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { isPlatformHttpResponse, knownError } from "../../responses.js";
import { playersWithBaselineSource } from "../playerCatalog/baseline.js";

export interface SeasonMockDraftContext {
  membership: PlatformLeagueMembership & { ownerId: string; teamId: string };
  season: ExplicitLeagueSeason;
  setup: LiveDraftRoomSetup;
}

export type SeasonMockDraftIdentityContext = Omit<SeasonMockDraftContext, "setup">;

const withCurrentProjectionFields = async (
  setup: LiveDraftRoomSetup,
  currentPlayerCatalogProvider: PlatformHttpServices["currentPlayerCatalogProvider"],
  draftFormat: ExplicitLeagueSeason["settings"]["draftFormat"],
): Promise<LiveDraftRoomSetup> => {
  if (currentPlayerCatalogProvider === undefined) return setup;
  const currentCatalog = await currentPlayerCatalogProvider();
  const currentPlayersByIdentity = new Map(
    currentCatalog.map(player => [canonicalPlayerIdentityKey(player.name), player]),
  );
  const playerCatalog = setup.playerCatalog.map(player => {
    const current = currentPlayersByIdentity.get(canonicalPlayerIdentityKey(player.name));
    if (current === undefined) return player;
    return {
      ...player,
      ...(current.week1Projection === undefined ? {} : { week1Projection: current.week1Projection }),
      ...(current.weeks1To4Projection === undefined ? {} : { weeks1To4Projection: current.weeks1To4Projection }),
      ...(current.seasonProjection === undefined ? {} : { seasonProjection: current.seasonProjection }),
      seasonProjectionAdjustmentFactor: current.seasonProjectionAdjustmentFactor,
      seasonProjectionScoring: current.seasonProjectionScoring,
    };
  });
  if (draftFormat !== "snake") return { ...setup, playerCatalog };
  const currentRanks = new Map(playersWithBaselineSource(currentCatalog).map(player => [
    canonicalPlayerIdentityKey(player.name),
    player.marketRank,
  ]));
  return {
    ...setup,
    playerCatalog: [...playerCatalog].sort((left, right) =>
      (currentRanks.get(canonicalPlayerIdentityKey(left.name)) ?? Number.MAX_SAFE_INTEGER)
      - (currentRanks.get(canonicalPlayerIdentityKey(right.name)) ?? Number.MAX_SAFE_INTEGER)
    ),
  };
};

export const seasonMockDraftSetupFor = async (
  season: ExplicitLeagueSeason,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<LiveDraftRoomSetup | PlatformHttpResponse> => {
  const stored = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
  if (stored !== null) return withCurrentProjectionFields(
    stored,
    services.currentPlayerCatalogProvider,
    season.settings.draftFormat,
  );
  const fallback = await services.liveDraftRoomSetupProvider?.(season) ?? null;
  if (fallback === null) {
    return knownError(503, "player_catalog_unavailable", "The current player catalog is unavailable.");
  }
  const setupInput = {
    seasonId: season.id,
    sourceVersion: `current-catalog-${season.seasonYear}`,
    playerCatalog: fallback.playerCatalog,
    initialRosters: fallback.initialRosters,
    updatedAt: request.now ?? new Date(),
  };
  return withCurrentProjectionFields(
    { ...setupInput, contentHash: liveDraftRoomSetupContentHash(setupInput) },
    services.currentPlayerCatalogProvider,
    season.settings.draftFormat,
  );
};

export const seasonMockDraftIdentityContextFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  seasonId: string,
): Promise<SeasonMockDraftIdentityContext> => {
  const account = await requireRequestAccount(app, request);
  const storedSeason: AnyLeagueSeason = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  const season = normalizeLeagueSeason(storedSeason);
  const membership = (await app.listLeagueMemberships(season.leagueId))
    .find(candidate => candidate.userId === account.id);
  if (membership?.ownerId === undefined || membership.teamId === undefined) {
    throw new PlatformAppError("team_claim_required", "Claim your team before starting a mock draft.");
  }
  return { membership: { ...membership, ownerId: membership.ownerId, teamId: membership.teamId }, season };
};

export const seasonMockDraftContextFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  seasonId: string,
): Promise<SeasonMockDraftContext | PlatformHttpResponse> => {
  const identityContext = await seasonMockDraftIdentityContextFor(app, request, seasonId);
  const setup = await seasonMockDraftSetupFor(identityContext.season, request, services);
  return isPlatformHttpResponse(setup) ? setup : { ...identityContext, setup };
};

export const isSeasonMockDraftContext = (
  value: SeasonMockDraftContext | PlatformHttpResponse,
): value is SeasonMockDraftContext => "membership" in value;

export const findSeasonMockDraftSession = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  context: SeasonMockDraftIdentityContext,
  sessionId: string,
): Promise<MockDraftSession> => {
  const sessions = await app.listMockDraftSessions({
    actorSessionToken: request.sessionToken,
    leagueId: context.season.leagueId,
    seasonId: context.season.id,
    ownerId: context.membership.ownerId,
    teamId: context.membership.teamId,
    now: request.now,
  });
  const session = sessions.find(candidate => candidate.id === sessionId);
  if (session === undefined) throw new MockDraftSessionError("session_not_found", "Mock draft session was not found.");
  return session;
};
