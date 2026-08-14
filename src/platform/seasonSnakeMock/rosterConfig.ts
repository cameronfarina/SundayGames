import type { Position } from "../../../config/league.js";
import type { ExplicitLeagueSeason, SnakeSettings } from "../leagueSeason/contracts.js";
import type { SnakeDraftRosterSlotConfig } from "../snakeDraftEngine/config.js";

const skillPositions: readonly Position[] = ["QB", "RB", "WR", "TE"];
const allPositions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

const eligiblePositionsForSlot = (slot: string): readonly string[] => {
  if (slot === "FLEX" || slot === "RB_WR_TE") return ["RB", "WR", "TE"];
  if (slot === "RB_WR") return ["RB", "WR"];
  if (slot === "WR_TE") return ["WR", "TE"];
  if (slot === "OP" || slot === "SUPERFLEX") return skillPositions;
  if (slot === "BENCH" || slot === "IR") return allPositions;
  if (allPositions.some(position => position === slot)) return [slot];
  return allPositions;
};

export const snakeRosterSlotsFor = (
  season: ExplicitLeagueSeason,
  snake: SnakeSettings,
): readonly SnakeDraftRosterSlotConfig[] => {
  const configured = Object.entries(season.settings.roster.lineup)
    .flatMap(([slot, count]) => typeof count === "number" && Number.isInteger(count) && count > 0
      ? [{ slot, count, eligiblePositions: eligiblePositionsForSlot(slot) }]
      : []);
  const capacity = configured.reduce((total, slot) => total + slot.count, 0);
  if (capacity >= snake.rounds) return configured;

  return [
    ...configured,
    {
      slot: "BENCH",
      count: snake.rounds - capacity,
      eligiblePositions: allPositions,
    },
  ];
};
