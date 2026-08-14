import { useState } from "react";

const ROW_BATCH_SIZE = 50;

interface IncrementalRowsState {
  readonly resetValues: readonly unknown[];
  readonly visibleRowCount: number;
}

const resetValuesMatch = (left: readonly unknown[], right: readonly unknown[]): boolean =>
  left.length === right.length && left.every((value, index) => Object.is(value, right[index]));

export const useIncrementalRows = (totalRowCount: number, resetValues: readonly unknown[]) => {
  const [state, setState] = useState<IncrementalRowsState>({
    resetValues,
    visibleRowCount: ROW_BATCH_SIZE,
  });
  const shouldReset = !resetValuesMatch(state.resetValues, resetValues);
  if (shouldReset) setState({ resetValues, visibleRowCount: ROW_BATCH_SIZE });
  const requestedRowCount = shouldReset ? ROW_BATCH_SIZE : state.visibleRowCount;
  const visibleRowCount = Math.min(requestedRowCount, totalRowCount);
  const revealRowCount = Math.min(ROW_BATCH_SIZE, totalRowCount - visibleRowCount);

  return {
    revealMore: () => {
      setState({ resetValues, visibleRowCount: visibleRowCount + revealRowCount });
    },
    revealRowCount,
    visibleRowCount,
  };
};
