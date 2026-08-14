import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import type {
  SeasonSimulationRosterPlayer,
  SeasonSimulationTeamResult,
} from "./contracts.js";

export const isStarterSlot = (slot: string): boolean => !/^(?:BENCH|IR)/u.test(slot);

export interface SimulationRosterSlot {
  slot: string;
  eligiblePositions: readonly string[];
}

export const optimizedRoster = (
  roster: readonly SeasonSimulationRosterPlayer[],
  slots: readonly SimulationRosterSlot[],
): readonly SeasonSimulationRosterPlayer[] => {
  if (roster.length === 0 || roster.length !== slots.length || roster.length > 30) return roster;
  const starterSlots = slots
    .filter(slot => isStarterSlot(slot.slot))
    .sort((left, right) =>
      left.eligiblePositions.length - right.eligiblePositions.length
      || left.slot.localeCompare(right.slot)
    );
  const reserveSlots = slots
    .filter(slot => !isStarterSlot(slot.slot))
    .sort((left, right) =>
      left.eligiblePositions.length - right.eligiblePositions.length
      || left.slot.localeCompare(right.slot)
    );

  const reserveAssignmentFor = (usedMask: number): ReadonlyMap<number, string> | null => {
    const assignment = new Map<number, string>();
    const assign = (slotIndex: number, assignedMask: number): boolean => {
      if (slotIndex === reserveSlots.length) return true;
      const slot = reserveSlots[slotIndex];
      if (slot === undefined) return false;
      for (let playerIndex = 0; playerIndex < roster.length; playerIndex += 1) {
        const player = roster[playerIndex];
        if (
          player === undefined
          || (assignedMask & (1 << playerIndex)) !== 0
          || !slot.eligiblePositions.includes(player.position)
        ) continue;
        assignment.set(playerIndex, slot.slot);
        if (assign(slotIndex + 1, assignedMask | (1 << playerIndex))) return true;
        assignment.delete(playerIndex);
      }
      return false;
    };

    return assign(0, usedMask) ? assignment : null;
  };

  let bestScore = Number.NEGATIVE_INFINITY;
  let bestAssignment: ReadonlyMap<number, string> | null = null;
  const starterAssignment = new Map<number, string>();
  const search = (slotIndex: number, usedMask: number, score: number): void => {
    if (slotIndex === starterSlots.length) {
      const reserveAssignment = reserveAssignmentFor(usedMask);
      if (reserveAssignment === null || score <= bestScore) return;
      bestScore = score;
      bestAssignment = new Map([...starterAssignment, ...reserveAssignment]);
      return;
    }
    const slot = starterSlots[slotIndex];
    if (slot === undefined) return;
    const candidates = roster
      .map((player, index) => ({ player, index }))
      .filter(({ player, index }) =>
        (usedMask & (1 << index)) === 0 && slot.eligiblePositions.includes(player.position)
      )
      .sort((left, right) =>
        right.player.week1Points - left.player.week1Points
        || left.player.playerId.localeCompare(right.player.playerId)
      );
    for (const { player, index } of candidates) {
      starterAssignment.set(index, slot.slot);
      search(slotIndex + 1, usedMask | (1 << index), score + player.week1Points);
      starterAssignment.delete(index);
    }
  };

  search(0, 0, 0);
  if (bestAssignment === null) return roster;
  return roster.map((player, index) => {
    const rosterSlot = bestAssignment?.get(index) ?? player.rosterSlot;
    return { ...player, rosterSlot, starter: isStarterSlot(rosterSlot) };
  });
};
export const week1PointsFor = (
  projectionsByPlayer: ReadonlyMap<string, number>,
  playerId: string,
): number => projectionsByPlayer.get(canonicalPlayerIdentityKey(playerId)) ?? 0;

export const teamResultFor = (
  input: Omit<SeasonSimulationTeamResult, "week1Points">,
  slots: readonly SimulationRosterSlot[],
): SeasonSimulationTeamResult => {
  const roster = optimizedRoster(input.roster, slots);
  return {
    ...input,
    roster,
    week1Points: roster.reduce(
      (total, player) => total + (player.starter ? player.week1Points : 0),
      0,
    ),
  };
};
