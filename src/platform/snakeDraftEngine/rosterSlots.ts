import type { SnakeDraftPlayer, SnakeDraftRosterSlotConfig } from "./config.js";
import type { SnakeDraftTeamReadModel, SnakeDraftTeamRosterSlot } from "./readModels.js";

export const expandedRosterSlotName = (
  slot: SnakeDraftRosterSlotConfig,
  index: number,
): string => slot.count === 1 ? slot.slot : `${slot.slot}${index + 1}`;

export const buildRosterSlots = (
  rosterSlots: readonly SnakeDraftRosterSlotConfig[],
): SnakeDraftTeamRosterSlot[] => rosterSlots.flatMap(slot =>
  Array.from({ length: slot.count }, (_, index) => ({
    slot: expandedRosterSlotName(slot, index),
    eligiblePositions: [...slot.eligiblePositions],
    playerId: undefined,
  })),
);

export const assignableSlot = (
  team: SnakeDraftTeamReadModel,
  player: SnakeDraftPlayer,
): SnakeDraftTeamRosterSlot | undefined => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(player.position))
  .sort((left, right) => left.eligiblePositions.length - right.eligiblePositions.length)[0];

export const rosterNeedFor = (
  team: SnakeDraftTeamReadModel,
  position: string,
): number => team.slots
  .filter(slot => slot.playerId === undefined && slot.eligiblePositions.includes(position))
  .reduce((total, slot) => total + (1 / slot.eligiblePositions.length), 0);
