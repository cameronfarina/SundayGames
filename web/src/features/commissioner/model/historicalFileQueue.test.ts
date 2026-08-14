import { describe, expect, it } from "vitest";
import {
  acceptedHistoricalFiles,
  duplicateHistoricalYears,
  historicalQueueReducer,
} from "./historicalFileQueue";

const file = (name: string, size = 10): File => new File(["x".repeat(size)], name, { lastModified: 1 });

describe("historical file queue", () => {
  it("accepts supported safe files and infers distinct years", () => {
    const files = [file("draft-2024.csv"), file("draft.tsv"), file("notes.txt")];
    const state = historicalQueueReducer([], { type: "add", files, currentYear: 2026 });

    expect(acceptedHistoricalFiles(files)).toHaveLength(2);
    expect(state.map(item => item.seasonYear)).toEqual([2024, 2024]);
    expect(duplicateHistoricalYears(state)).toBe(true);
    expect(historicalQueueReducer(state, { type: "add", files, currentYear: 2026 })).toEqual(state);
  });

  it("updates years, mappings, results, and removal without mutating the queue", () => {
    const initial = historicalQueueReducer([], { type: "add", files: [file("draft.csv")], currentYear: 2026 });
    const id = initial[0]?.id ?? "missing";
    const dated = historicalQueueReducer(initial, { type: "year", id, seasonYear: 2023 });
    const mapped = historicalQueueReducer(dated, { type: "mapping", id, label: "Old Cam", teamId: "team-1" });
    const failed = historicalQueueReducer(mapped, {
      type: "result", id, status: "error", message: "Missing player", ownerNeeds: ["Old Cam"],
    });

    expect(mapped[0]?.ownerMappings).toEqual({ "Old Cam": "team-1" });
    expect(failed[0]).toMatchObject({ seasonYear: 2023, status: "error", ownerNeeds: ["Old Cam"] });
    expect(historicalQueueReducer(failed, { type: "remove", id })).toEqual([]);
    expect(duplicateHistoricalYears(failed)).toBe(false);
  });

  it("rejects oversized files", () => {
    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "draft.xlsx");
    expect(acceptedHistoricalFiles([oversized])).toEqual([]);
  });
});
