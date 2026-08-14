import type {
  LineupChoice,
  ResultCandidate,
  ResultSlot,
} from "./types.js";

const memoKey = (slotIndex: number, usedIndexes: ReadonlySet<number>): string =>
  `${slotIndex}:${[...usedIndexes].sort((left, right) => left - right).join(",")}`;

export const bestProjectedLineup = (
  slots: readonly ResultSlot[],
  players: readonly ResultCandidate[],
): LineupChoice => {
  const orderedSlots = [...slots].sort((left, right) =>
    left.eligiblePositions.length - right.eligiblePositions.length
    || left.originalIndex - right.originalIndex
  );
  const memo = new Map<string, LineupChoice>();

  const visit = (slotIndex: number, usedIndexes: ReadonlySet<number>): LineupChoice => {
    if (slotIndex >= orderedSlots.length) return { score: 0, assignments: [] };
    const key = memoKey(slotIndex, usedIndexes);
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const slot = orderedSlots[slotIndex];
    if (slot === undefined) return { score: 0, assignments: [] };
    const eligibleIndexes = players.flatMap((player, playerIndex) =>
      !usedIndexes.has(playerIndex) && slot.eligiblePositions.includes(player.position)
        ? [playerIndex]
        : []
    );
    if (eligibleIndexes.length === 0) {
      const unfilled = visit(slotIndex + 1, usedIndexes);
      memo.set(key, unfilled);
      return unfilled;
    }

    let best: LineupChoice | undefined;
    for (const playerIndex of eligibleIndexes) {
      const player = players[playerIndex];
      if (player === undefined) continue;
      const remaining = visit(slotIndex + 1, new Set([...usedIndexes, playerIndex]));
      const candidate: LineupChoice = {
        score: player.week1Points + remaining.score,
        assignments: [
          { slot: slot.slot, playerId: player.playerId },
          ...remaining.assignments,
        ],
      };
      if (best === undefined || candidate.score > best.score) best = candidate;
    }

    const result = best ?? { score: 0, assignments: [] };
    memo.set(key, result);
    return result;
  };

  return visit(0, new Set());
};
