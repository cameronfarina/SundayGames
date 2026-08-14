import type { GenericAuctionMockTeamReadModel } from "../../genericAuctionMockEngine.js";

export const canFitTargetPositions = (
  positions: readonly string[],
  openSlots: GenericAuctionMockTeamReadModel["slots"],
): boolean => {
  const orderedPositions = [...positions].sort((left, right) => {
    const leftOptions = openSlots.filter(slot => slot.eligiblePositions.includes(left)).length;
    const rightOptions = openSlots.filter(slot => slot.eligiblePositions.includes(right)).length;
    return leftOptions - rightOptions;
  });
  const positionBySlotIndex = new Map<number, string>();
  const assign = (position: string, visitedSlotIndexes: Set<number>): boolean => {
    for (const [slotIndex, slot] of openSlots.entries()) {
      if (visitedSlotIndexes.has(slotIndex) || !slot.eligiblePositions.includes(position)) continue;
      visitedSlotIndexes.add(slotIndex);
      const assignedPositionIndex = positionBySlotIndex.get(slotIndex);
      if (assignedPositionIndex === undefined || assign(assignedPositionIndex, visitedSlotIndexes)) {
        positionBySlotIndex.set(slotIndex, position);
        return true;
      }
    }
    return false;
  };

  return orderedPositions.every(position => assign(position, new Set()));
};

export const positionsStayWithinMaximums = (
  positionCounts: Readonly<Record<string, number>>,
  positionMaximums: Readonly<Record<string, number>>,
): boolean => !Object.entries(positionCounts).some(([position, count]) =>
  count > (positionMaximums[position] ?? 0)
);
