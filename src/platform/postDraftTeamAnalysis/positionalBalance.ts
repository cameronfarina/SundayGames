import type { Position } from "../../../config/league.js";
import type {
  PostDraftRosterSettings,
  PostDraftTeamRoster,
} from "./contracts/core.js";
import type { PositionBalanceDetail } from "./contracts/ranking.js";
import type { TeamComponentValues } from "./internalTypes.js";
import { round } from "./numbers.js";

export const positionalBalanceFor = (
  roster: PostDraftTeamRoster,
  settings: PostDraftRosterSettings,
): Pick<TeamComponentValues, "positionalBalanceScore" | "positionDetails"> => {
  const demandByPosition = new Map<Position, number>();
  for (const slot of settings.starterSlots) {
    const share = 1 / slot.eligiblePositions.length;
    for (const position of slot.eligiblePositions) {
      demandByPosition.set(position, (demandByPosition.get(position) ?? 0) + share);
    }
  }

  const starterSlotCount = settings.starterSlots.length;
  const positionDetails = [...demandByPosition.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([position, demand]): PositionBalanceDetail => ({
      position,
      actualPlayers: roster.players.filter(player => player.position === position).length,
      expectedPlayers: round(starterSlotCount === 0 ? 0 : (demand / starterSlotCount) * settings.rosterSize),
    }));
  const totalDeviation = positionDetails.reduce(
    (total, detail) => total + Math.abs(detail.actualPlayers - detail.expectedPlayers),
    0,
  );
  const score = settings.rosterSize === 0
    ? 0
    : Math.max(0, 100 * (1 - totalDeviation / (2 * settings.rosterSize)));

  return { positionalBalanceScore: round(score), positionDetails };
};
