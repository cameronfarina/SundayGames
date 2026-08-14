import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "./liveDraftRooms.js";

type ProtectedStarterPosition = "QB" | "TE" | "K" | "DST";

type ProjectionCoverageMode = "complete" | "partial" | "missing";

const protectedStarterPositions: readonly ProtectedStarterPosition[] = [
  "QB",
  "TE",
  "K",
  "DST",
];

const nflTeamCount = 32;

const viableStarterDepthByPosition: Readonly<Record<ProtectedStarterPosition, number>> = {
  QB: nflTeamCount,
  TE: nflTeamCount,
  K: nflTeamCount,
  DST: nflTeamCount,
};

const minimumWeeklyProjectionShareByPosition: Readonly<
  Record<ProtectedStarterPosition, number>
> = {
  QB: 0.25,
  TE: 0.1,
  K: 0.5,
  DST: 0.25,
};

export const isProtectedStarterPosition = (
  position: LiveDraftRoomPlayerCatalogEntry["position"],
): position is ProtectedStarterPosition => position === "QB"
  || position === "TE"
  || position === "K"
  || position === "DST";

const projectedWeeklyProductionFor = (player: LiveDraftRoomPlayerCatalogEntry): number =>
  player.week1Projection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection / 4)
  ?? (player.seasonProjection === undefined ? 0 : player.seasonProjection / 17);

const projectedSeasonProductionFor = (player: LiveDraftRoomPlayerCatalogEntry): number =>
  player.seasonProjection
  ?? (player.weeks1To4Projection === undefined ? undefined : player.weeks1To4Projection * 4.25)
  ?? (player.week1Projection === undefined ? 0 : player.week1Projection * 17);

const nflTeamKeyFor = (player: LiveDraftRoomPlayerCatalogEntry): string | undefined => {
  const key = player.teamAbbreviation?.trim().toUpperCase();
  return key === undefined || key.length === 0 ? undefined : key;
};

const hasProjectionFor = (player: LiveDraftRoomPlayerCatalogEntry): boolean =>
  player.week1Projection !== undefined
  || player.weeks1To4Projection !== undefined
  || player.seasonProjection !== undefined;

const projectionCoverageModeFor = (
  players: readonly LiveDraftRoomPlayerCatalogEntry[],
): ProjectionCoverageMode => {
  const projectedCount = players.filter(hasProjectionFor).length;
  if (projectedCount === 0) return "missing";
  return projectedCount === players.length ? "complete" : "partial";
};

const marketFallbackCandidatesFor = (
  players: readonly LiveDraftRoomPlayerCatalogEntry[],
  coverageMode: ProjectionCoverageMode,
): readonly LiveDraftRoomPlayerCatalogEntry[] => coverageMode === "complete"
  ? []
  : players
    .filter(player => !hasProjectionFor(player) && nflTeamKeyFor(player) !== undefined)
    .sort((left, right) =>
      right.expectedPrice - left.expectedPrice
      || canonicalPlayerIdentityKey(left.name).localeCompare(canonicalPlayerIdentityKey(right.name))
    );

export const starterEligiblePlayerIdsFor = (
  players: readonly LiveDraftRoomPlayerCatalogEntry[],
): ReadonlySet<string> => {
  const eligiblePlayerIds = new Set<string>();

  for (const position of protectedStarterPositions) {
    const representedTeams = new Set<string>();
    const positionPlayers = players.filter(player => player.position === position);
    const coverageMode = projectionCoverageModeFor(positionPlayers);
    const positiveCandidates = positionPlayers.filter(player =>
      hasProjectionFor(player) && projectedWeeklyProductionFor(player) > 0
    );
    const topWeeklyProjection = positiveCandidates.reduce(
      (topProjection, player) => Math.max(topProjection, projectedWeeklyProductionFor(player)),
      0,
    );
    const minimumWeeklyProjection = topWeeklyProjection
      * minimumWeeklyProjectionShareByPosition[position];
    const projectedCandidates = positiveCandidates
      .filter(player => projectedWeeklyProductionFor(player) >= minimumWeeklyProjection)
      .sort((left, right) =>
        projectedSeasonProductionFor(right) - projectedSeasonProductionFor(left)
        || projectedWeeklyProductionFor(right) - projectedWeeklyProductionFor(left)
        || right.expectedPrice - left.expectedPrice
        || canonicalPlayerIdentityKey(left.name).localeCompare(canonicalPlayerIdentityKey(right.name))
      );
    const candidates = [
      ...projectedCandidates,
      ...marketFallbackCandidatesFor(positionPlayers, coverageMode),
    ];
    let eligibleCount = 0;

    for (const player of candidates) {
      if (eligibleCount >= viableStarterDepthByPosition[position]) break;
      const teamKey = nflTeamKeyFor(player);
      if (teamKey !== undefined && representedTeams.has(teamKey)) continue;

      eligiblePlayerIds.add(canonicalPlayerIdentityKey(player.name));
      eligibleCount += 1;
      if (teamKey !== undefined) representedTeams.add(teamKey);
    }
  }

  return eligiblePlayerIds;
};
