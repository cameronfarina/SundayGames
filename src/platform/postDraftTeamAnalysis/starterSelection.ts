import type {
  PostDraftProjection,
} from "./contracts/projections.js";
import type {
  PostDraftStarterSlot,
  PostDraftTeamRoster,
} from "./contracts/core.js";
import type { StarterSelection } from "./internalTypes.js";
import { round } from "./numbers.js";

interface Assignment {
  playerIndex: number;
  slotIndex: number;
}

interface SelectionState {
  projectedPoints: number;
  assignments: readonly Assignment[];
}

const bitCount = (value: number): number => {
  let remaining = value;
  let count = 0;
  while (remaining !== 0) {
    count += remaining & 1;
    remaining >>>= 1;
  }
  return count;
};

const bestSelection = (states: ReadonlyMap<number, SelectionState>): readonly [number, SelectionState] =>
  [...states.entries()].sort(([leftMask, left], [rightMask, right]) =>
    bitCount(rightMask) - bitCount(leftMask) || right.projectedPoints - left.projectedPoints
  )[0] ?? [0, { projectedPoints: 0, assignments: [] }];

export const selectStarters = (
  roster: PostDraftTeamRoster,
  projectionsByPlayerId: ReadonlyMap<string, PostDraftProjection>,
  slots: readonly PostDraftStarterSlot[],
): StarterSelection => {
  let states = new Map<number, SelectionState>([[0, { projectedPoints: 0, assignments: [] }]]);

  roster.players.forEach((player, playerIndex) => {
    const projection = projectionsByPlayerId.get(player.playerId);
    if (projection === undefined) return;
    const nextStates = new Map(states);
    for (const [mask, state] of states) {
      slots.forEach((slot, slotIndex) => {
        const slotBit = 1 << slotIndex;
        if ((mask & slotBit) !== 0 || !slot.eligiblePositions.includes(player.position)) return;
        const nextMask = mask | slotBit;
        const candidate: SelectionState = {
          projectedPoints: state.projectedPoints + projection.seasonProjectedPoints,
          assignments: [...state.assignments, { playerIndex, slotIndex }],
        };
        const current = nextStates.get(nextMask);
        if (current === undefined || candidate.projectedPoints > current.projectedPoints) {
          nextStates.set(nextMask, candidate);
        }
      });
    }
    states = nextStates;
  });

  const [mask, best] = bestSelection(states);
  const assignments = [...best.assignments].sort((left, right) => left.slotIndex - right.slotIndex);
  return {
    projectedPoints: round(best.projectedPoints),
    selectedPlayerIndexes: new Set(assignments.map(assignment => assignment.playerIndex)),
    filledSlots: bitCount(mask),
    lineup: assignments.map(assignment => {
      const player = roster.players[assignment.playerIndex];
      const slot = slots[assignment.slotIndex];
      const projection = player === undefined ? undefined : projectionsByPlayerId.get(player.playerId);
      if (player === undefined || slot === undefined || projection === undefined) {
        throw new Error("Starter assignment references unavailable roster inputs.");
      }
      return {
        slot: slot.slot,
        playerId: player.playerId,
        playerName: player.playerName,
        position: player.position,
        projectedPoints: round(projection.seasonProjectedPoints),
      };
    }),
  };
};
