import type { Position } from "../../../config/league.js";
import { analyzeRosterSlots } from "../leagueCreation.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoomRosterPlayer,
  LiveDraftRoomRosterSlot,
} from "./contracts/players.js";

interface AssignableRosterSlot extends LiveDraftRoomRosterSlot {
  eligiblePositions: readonly Position[];
}

const emptyRosterSlotsFor = (season: LeagueSeason): AssignableRosterSlot[] =>
  analyzeRosterSlots(season.settings.roster.lineup).draftableSlots.flatMap(slot =>
    Array.from({ length: slot.count }, (_, index) => ({
      slot: slot.count === 1 ? slot.slot : `${slot.slot}${index + 1}`,
      eligiblePositions: slot.eligiblePositions,
    })),
  );

const sortedRoster = (
  roster: readonly LiveDraftRoomRosterPlayer[],
): LiveDraftRoomRosterPlayer[] =>
  [...roster].sort(
    (left, right) =>
      right.price - left.price
      || right.expectedPrice - left.expectedPrice
      || left.name.localeCompare(right.name),
  );

export const rosterSlotsFor = (
  season: LeagueSeason,
  roster: readonly LiveDraftRoomRosterPlayer[],
): readonly LiveDraftRoomRosterSlot[] => {
  const slots = emptyRosterSlotsFor(season);
  const assignedPlayers: Array<LiveDraftRoomRosterPlayer | undefined> = slots.map(() => undefined);
  const eligibleSlotCountFor = (player: LiveDraftRoomRosterPlayer): number =>
    slots.filter(slot => slot.eligiblePositions.includes(player.position)).length;
  const players = sortedRoster(roster).sort((left, right) =>
    eligibleSlotCountFor(left) - eligibleSlotCountFor(right)
    || right.price - left.price
    || left.name.localeCompare(right.name)
  );
  const assign = (player: LiveDraftRoomRosterPlayer, visited: Set<number>): boolean => {
    const eligibleSlotIndexes = slots
      .map((slot, index) => ({ slot, index }))
      .filter(candidate => candidate.slot.eligiblePositions.includes(player.position))
      .sort((left, right) =>
        left.slot.eligiblePositions.length - right.slot.eligiblePositions.length
        || left.index - right.index
      );

    for (const { index } of eligibleSlotIndexes) {
      if (visited.has(index)) continue;
      visited.add(index);
      const previousPlayer = assignedPlayers[index];
      if (previousPlayer === undefined || assign(previousPlayer, visited)) {
        assignedPlayers[index] = player;
        return true;
      }
    }
    return false;
  };

  for (const player of players) assign(player, new Set());
  return slots.map((slot, index) => ({
    slot: slot.slot,
    ...(assignedPlayers[index] === undefined ? {} : { player: assignedPlayers[index] }),
  }));
};

export const rosterFitsDraftSlots = (
  season: LeagueSeason,
  roster: readonly LiveDraftRoomRosterPlayer[],
): boolean => rosterSlotsFor(season, roster)
  .filter(slot => slot.player !== undefined).length === roster.length;
