import type { LeagueSeason } from "../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../liveDraftRooms.js";
import { eligiblePositionsForSlot } from "./rosterSlots.js";

export const teamRosterFitsConfiguredSlots = (
  season: LeagueSeason,
  players: readonly LiveDraftRoomInitialRosterPlayer[],
): boolean => {
  const slots = Object.entries(season.settings.roster.lineup).flatMap(([slot, count]) =>
    Number.isInteger(count) && count > 0
      ? Array.from({ length: count }, () => eligiblePositionsForSlot(slot))
      : []
  );
  const missingBenchSlots = season.settings.roster.rosterSize - slots.length;
  if (missingBenchSlots > 0) {
    slots.push(...Array.from(
      { length: missingBenchSlots },
      () => eligiblePositionsForSlot("BENCH"),
    ));
  }

  const playerBySlot = new Array<number>(slots.length).fill(-1);
  const assignPlayer = (playerIndex: number, visitedSlots: Set<number>): boolean => {
    const player = players[playerIndex];
    if (player === undefined) return false;

    for (const [slotIndex, eligiblePositions] of slots.entries()) {
      if (visitedSlots.has(slotIndex) || !eligiblePositions.includes(player.position)) continue;
      visitedSlots.add(slotIndex);
      const assignedPlayerIndex = playerBySlot[slotIndex];
      if (
        assignedPlayerIndex === undefined
        || assignedPlayerIndex === -1
        || assignPlayer(assignedPlayerIndex, visitedSlots)
      ) {
        playerBySlot[slotIndex] = playerIndex;
        return true;
      }
    }
    return false;
  };

  return players.every((_, playerIndex) => assignPlayer(playerIndex, new Set()));
};
