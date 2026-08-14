import { type Owner, type Position } from "../../config/league.js";
import { nflTeamByEspnProTeamId } from "../../config/nflTeams.js";
import { normalizePlayerName } from "../data/normalizePlayerName.js";
import type {
  LiveDraftRosterPlayer,
  LiveDraftState,
  LiveDraftTarget,
} from "../modeling/liveDraft.js";
import type { MyExpertAdviceCard, MyExpertPlayer } from "../modeling/myExpert.js";
import type { PlayerNewsPlayerMetadata } from "../modeling/playerNews.js";
import type { ProjectionRecord } from "../projections.js";
import type { MyExpertRecommendation } from "./contracts.js";

export const myExpertIdFor = (name: string): string =>
  normalizePlayerName(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";

const projectedPointsFromProjection = (
  projection: ProjectionRecord | undefined,
  currentWeek: number,
  fallback: number,
): number => {
  const weekly = projection?.weeks[currentWeek] ??
    (projection && projection.weeks1To4 > 0 ? projection.weeks1To4 / 4 : undefined);
  return Math.max(1, Math.round(((weekly ?? fallback) + Number.EPSILON) * 10) / 10);
};

export const projectionLookupKeyFor = (name: string, position: Position): string =>
  `${normalizePlayerName(name)}:${position}`;

export const projectionLookupFor = (
  projections: readonly ProjectionRecord[],
): ReadonlyMap<string, ProjectionRecord> => new Map(
  projections.map(projection => [projectionLookupKeyFor(projection.name, projection.position), projection]),
);

export const playerNewsMetadataFor = (
  projections: readonly ProjectionRecord[],
): PlayerNewsPlayerMetadata[] => projections.map(projection => {
  const team = projection.proTeamId === undefined
    ? undefined
    : nflTeamByEspnProTeamId[projection.proTeamId];
  return {
    name: projection.name,
    normalizedPlayerName: normalizePlayerName(projection.name),
    position: projection.position,
    ...(team ? { teamAbbreviation: team.abbreviation } : {}),
  };
});

export const rosterRoleByPlayerId = (
  slots: LiveDraftState["watchOwner"]["slots"],
): Map<string, MyExpertPlayer["rosteredRole"]> => {
  const roles = new Map<string, MyExpertPlayer["rosteredRole"]>();
  for (const slot of slots) {
    if (slot.player) {
      roles.set(myExpertIdFor(slot.player.name), slot.slot.startsWith("BENCH") ? "bench" : "starter");
    }
  }
  return roles;
};

const optionalMetadata = (
  player: Pick<LiveDraftRosterPlayer | LiveDraftTarget, "teamAbbreviation" | "byeWeek">,
): Pick<MyExpertPlayer, "teamAbbreviation" | "byeWeek"> => ({
  ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
  ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
});

export const myExpertRosterPlayerFrom = (
  player: LiveDraftRosterPlayer,
  role: MyExpertPlayer["rosteredRole"],
  projection: ProjectionRecord | undefined,
  currentWeek: number,
): MyExpertPlayer => ({
  id: myExpertIdFor(player.name),
  name: player.name,
  position: player.position,
  projectedPoints: projectedPointsFromProjection(
    projection,
    currentWeek,
    player.expectedPrice || player.price,
  ),
  rosteredRole: role,
  ...optionalMetadata(player),
});

export const myExpertAvailablePlayerFrom = (target: LiveDraftTarget): MyExpertPlayer => ({
  id: myExpertIdFor(target.name),
  name: target.name,
  position: target.position,
  projectedPoints: Math.max(
    1,
    Math.round((((target.weeks1To4 ?? target.liveExpectedPrice * 4) / 4) + Number.EPSILON) * 10) / 10,
  ),
  signals: {
    opportunityScore: Math.max(0, target.personalValue - target.liveExpectedPrice) / 5,
    trendScore: Math.max(0, target.valueScore) / 10,
  },
  ...optionalMetadata(target),
});

export const recommendationFrom = ({
  card,
  playersById,
  rosterIds,
}: {
  card: MyExpertAdviceCard;
  playersById: ReadonlyMap<string, MyExpertPlayer>;
  rosterIds: ReadonlySet<string>;
}): MyExpertRecommendation => {
  const players: MyExpertPlayer[] = [];
  for (const playerId of card.playerIds) {
    const player = playersById.get(playerId);
    if (player) players.push(player);
  }
  return {
    id: card.id,
    type: card.type,
    priority: card.priority,
    title: card.title,
    detail: card.summary,
    players,
    suggestedAdds: players.filter(player => !rosterIds.has(player.id)),
    suggestedDrops: card.type === "add-drop" ? players.filter(player => rosterIds.has(player.id)) : [],
    reasons: card.reasons,
    actionLabel: card.action.label,
    readOnly: card.action.readOnly,
    ...(card.lineup ? { lineup: card.lineup } : {}),
  };
};

export const ownerSummary = (
  owner: Owner,
  rosteredValue: number,
  players: MyExpertPlayer[],
): { owner: Owner; rosteredCount: number; rosteredValue: number; players: MyExpertPlayer[] } => ({
  owner,
  rosteredCount: players.length,
  rosteredValue,
  players,
});
