import { describe, expect, it } from "vitest";
import type { PracticeShortlistItem } from "../api/practiceContextSchema";
import { removeShortlistTarget, replaceShortlistTarget } from "./shortlist";

const item = (id: string, playerName: string): PracticeShortlistItem => ({
  createdAt: "2026-08-13T12:00:00.000Z",
  id,
  leagueId: "league-1",
  playerName,
  position: "WR",
  priority: 1,
  seasonId: "season-1",
  updatedAt: "2026-08-13T12:00:00.000Z",
  userId: "user-1",
});

describe("shortlist updates", () => {
  it("adds to an empty cache and replaces a normalized player match", () => {
    const puka = item("new", "Puka Nacua");
    expect(replaceShortlistTarget(undefined, puka)).toEqual([puka]);
    expect(replaceShortlistTarget([item("old", " puka   nacua "), item("other", "Jared Goff")], puka))
      .toEqual([item("other", "Jared Goff"), puka]);
  });

  it("removes a normalized player match from present or empty caches", () => {
    expect(removeShortlistTarget([item("puka", "Puka Nacua")], " puka nacua ")).toEqual([]);
    expect(removeShortlistTarget(undefined, "Puka Nacua")).toEqual([]);
  });
});
