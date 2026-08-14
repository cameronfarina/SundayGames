import type { Position } from "../../../config/league.js";
import type {
  LiveDraftRosterPlayer,
  LiveDraftRosterSlot,
  LiveDraftRosterSlotKey,
} from "./contracts.js";
import { flexEligiblePositions, lineupSlotKeys } from "./constants.js";

export const sortRosterPlayers = (
  players: readonly LiveDraftRosterPlayer[],
): LiveDraftRosterPlayer[] => [...players].sort((left, right) =>
  right.price - left.price
  || right.expectedPrice - left.expectedPrice
  || left.name.localeCompare(right.name));

const emptyRosterSlots = (): LiveDraftRosterSlot[] => lineupSlotKeys.map(slot => ({ slot }));

const placeInSlot = (
  slots: LiveDraftRosterSlot[],
  indexes: ReadonlyMap<LiveDraftRosterSlotKey, number>,
  slot: LiveDraftRosterSlotKey,
  player: LiveDraftRosterPlayer | undefined,
): void => {
  if (!player) return;
  const index = indexes.get(slot);
  if (index !== undefined) slots[index] = { slot, player };
};

const firstEmptyBenchSlot = (
  slots: readonly LiveDraftRosterSlot[],
): LiveDraftRosterSlotKey | undefined =>
  slots.find(slot => slot.slot.startsWith("BENCH") && !slot.player)?.slot;

const isFlexEligible = (position: Position): boolean =>
  flexEligiblePositions.some(flexPosition => flexPosition === position);

const primaryAssignmentsFor = (
  roster: readonly LiveDraftRosterPlayer[],
): [LiveDraftRosterSlotKey, LiveDraftRosterPlayer | undefined][] => {
  const playersAt = (position: Position): LiveDraftRosterPlayer[] =>
    sortRosterPlayers(roster.filter(player => player.position === position));
  const qbs = playersAt("QB");
  const rbs = playersAt("RB");
  const wrs = playersAt("WR");
  const tes = playersAt("TE");
  const kickers = playersAt("K");
  const defenses = playersAt("DST");
  return [
    ["QB", qbs[0]], ["RB1", rbs[0]], ["RB2", rbs[1]],
    ["WR1", wrs[0]], ["WR2", wrs[1]], ["TE", tes[0]],
    ["K", kickers[0]], ["DST", defenses[0]],
  ];
};

export const rosterSlotsFor = (
  roster: readonly LiveDraftRosterPlayer[],
): LiveDraftRosterSlot[] => {
  const slots = emptyRosterSlots();
  const indexes = new Map(slots.map((slot, index) => [slot.slot, index]));
  const usedPlayers = new Set<LiveDraftRosterPlayer>();
  for (const [slot, player] of primaryAssignmentsFor(roster)) {
    placeInSlot(slots, indexes, slot, player);
    if (player) usedPlayers.add(player);
  }
  const flex = sortRosterPlayers(
    roster.filter(player => isFlexEligible(player.position) && !usedPlayers.has(player)),
  )[0];
  placeInSlot(slots, indexes, "FLEX", flex);
  if (flex) usedPlayers.add(flex);

  for (const player of sortRosterPlayers(roster.filter(candidate => !usedPlayers.has(candidate)))) {
    const benchSlot = firstEmptyBenchSlot(slots);
    if (!benchSlot) break;
    placeInSlot(slots, indexes, benchSlot, player);
  }
  return slots;
};
