import { describe, expect, it } from "vitest";
import { liveDraftPickSchema } from "../api/liveDraftSchemas";
import { pickBoardColumns, pickBoardRows } from "./pickGrid";

const pick = (overall: number, round: number, pickInRound: number, owner: string) =>
  liveDraftPickSchema.parse({
    overall,
    round,
    pickInRound,
    teamId: `team-${owner}`,
    ownerDisplayName: owner,
    teamDisplayName: `${owner} Team`,
  });

const picks = [
  pick(2, 1, 2, "Bo"),
  pick(1, 1, 1, "Al"),
  pick(3, 2, 1, "Bo"),
  pick(4, 2, 2, "Al"),
];

describe("pickBoardColumns", () => {
  it("orders the columns the way round one runs", () => {
    expect(pickBoardColumns(picks).map(column => column.label)).toEqual(["Al", "Bo"]);
  });
});

describe("pickBoardRows", () => {
  it("keeps a team in its own column when the round reverses", () => {
    const rows = pickBoardRows(picks, pickBoardColumns(picks));

    expect(rows.map(row => row.round)).toEqual([1, 2]);
    expect(rows.map(row => row.cells.map(cell => cell.pick?.overall))).toEqual([[1, 2], [4, 3]]);
  });

  it("leaves a cell empty when a team has no pick in the round", () => {
    const rows = pickBoardRows([...picks, pick(5, 3, 1, "Al")], pickBoardColumns(picks));

    expect(rows[2]?.cells.map(cell => cell.pick?.overall)).toEqual([5, undefined]);
  });
});
