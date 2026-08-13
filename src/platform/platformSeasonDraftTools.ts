import { leagueConfig, ownerOrder, type Owner } from "../../config/league.js";
import { isDeepStrictEqual } from "node:util";
import type { KeeperDeclaration } from "../../config/keepers.js";
import { nflTeamByEspnProTeamId } from "../../config/nflTeams.js";
import type { CreateLiveDraftServerOptions } from "../liveDraftServer.js";
import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import { loadCurrentProjections, type ProjectionRecord } from "../projections.js";
import type { LeagueSeason } from "./leagueSeason.js";
import { buildCurrentMockdLeagueSeason } from "./leagueSeason.js";
import type { LiveDraftRoomSetup } from "./liveDraftRoomSetups.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const expectedSeasonSettings = buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig).settings;

const ownerFor = (value: string): Owner | undefined =>
  ownerOrder.find(owner => owner === value);

const proTeamIdFor = (abbreviation: string | undefined): number | undefined => {
  if (abbreviation === undefined) return undefined;
  const match = Object.entries(nflTeamByEspnProTeamId)
    .find(([, team]) => team?.abbreviation === abbreviation);

  return match === undefined ? undefined : Number(match[0]);
};

const assertSupportedSeason = (season: LeagueSeason): void => {
  const ownersByDraftOrder = [...season.teams]
    .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
    .map(team => team.ownerDisplayName);
  if (!isDeepStrictEqual(ownersByDraftOrder, [...ownerOrder])) {
    throw new Error(
      "Private draft tools support the configured 14-owner Mockd league order only.",
    );
  }
  if (!isDeepStrictEqual(season.settings, expectedSeasonSettings)) {
    throw new Error(
      "Private draft tools do not support this season's auction or roster settings.",
    );
  }
};

const projectionFor = (
  player: LiveDraftRoomSetup["playerCatalog"][number],
  index: number,
  source: ProjectionRecord | undefined,
): ProjectionRecord => {
  const proTeamId = proTeamIdFor(player.teamAbbreviation);

  return {
    id: source?.id ?? 10_000_000 + index,
    name: player.name,
    position: player.position,
    ...(proTeamId === undefined ? {} : { proTeamId }),
    weeks: source?.weeks ?? {},
    weeks1To4: source?.weeks1To4 ?? 0,
    ...(source?.seasonProjection === undefined ? {} : { seasonProjection: source.seasonProjection }),
    ...(source?.projectionCalibration === undefined
      ? {}
      : { projectionCalibration: source.projectionCalibration }),
    espnRank: index + 1,
    espnAuctionValue: player.expectedPrice,
  };
};

export const buildSeasonDraftToolsOptions = async (
  season: LeagueSeason,
  setup: LiveDraftRoomSetup,
): Promise<CreateLiveDraftServerOptions> => {
  if (setup.seasonId !== season.id) {
    throw new Error("Private draft setup does not belong to the selected season.");
  }
  assertSupportedSeason(season);

  const sourceProjections = await loadCurrentProjections({ projectionPath });
  const sourceByIdentity = new Map(
    sourceProjections.map(projection => [canonicalPlayerIdentityKey(projection.name), projection]),
  );
  const projections = setup.playerCatalog.map((player, index) => projectionFor(
    player,
    index,
    sourceByIdentity.get(canonicalPlayerIdentityKey(player.name)),
  ));
  const teamsById = new Map(season.teams.map(team => [team.id, team]));
  const configuredKeepers: KeeperDeclaration[] = setup.initialRosters.map(player => {
    const team = teamsById.get(player.teamId);
    const owner = team === undefined ? undefined : ownerFor(team.ownerDisplayName);
    if (team === undefined || owner === undefined) {
      throw new Error(`Private draft setup references unknown team ${player.teamId}.`);
    }

    return {
      owner,
      player: player.playerName,
      position: player.position,
      priorCost: player.price,
      newCost: player.price,
      status: "confirmed",
      notes: player.source === "keeper" ? "Provisioned keeper" : "Provisioned roster player",
    };
  });

  return {
    projections,
    keepers: configuredKeepers,
  };
};
