import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIncrementalRows } from "./useIncrementalRows";

interface HookProps {
  readonly resetValue: string;
  readonly totalRowCount: number;
}

describe("useIncrementalRows", () => {
  it("bounds, reveals, resets, and clamps rows", () => {
    const { result, rerender } = renderHook(
      ({ resetValue, totalRowCount }: HookProps) => useIncrementalRows(totalRowCount, [resetValue]),
      { initialProps: { resetValue: "all", totalRowCount: 500 } },
    );

    expect(result.current.visibleRowCount).toBe(50);
    expect(result.current.revealRowCount).toBe(50);
    act(() => { result.current.revealMore(); });
    expect(result.current.visibleRowCount).toBe(100);

    rerender({ resetValue: "quarterbacks", totalRowCount: 250 });
    expect(result.current.visibleRowCount).toBe(50);
    expect(result.current.revealRowCount).toBe(50);

    rerender({ resetValue: "all", totalRowCount: 500 });
    expect(result.current.visibleRowCount).toBe(50);

    rerender({ resetValue: "quarterbacks", totalRowCount: 20 });
    expect(result.current.visibleRowCount).toBe(20);
    expect(result.current.revealRowCount).toBe(0);
  });
});
