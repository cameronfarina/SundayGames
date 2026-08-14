import { describe, expect, it } from "vitest";
import { parseKeeperCommand } from "../src/platform/keeperCommandImport.js";
import { auctionCommandInput, snakeCommandInput } from "./keeperCommandImportFixtures.js";

describe("keeper command validation", () => {
  it("returns the command format error", () => {
    expect(parseKeeperCommand(snakeCommandInput("owner01 dart 2"))).toEqual({
      kind: "error",
      error: {
        code: "invalid_format",
        message: "Use '<team or manager> keeping <player> <number>'.",
      },
    });
  });

  it("returns the whole-number error", () => {
    expect(parseKeeperCommand(auctionCommandInput("owner01 keeping dart $5"))).toEqual({
      kind: "error",
      error: {
        code: "invalid_value",
        message: 'Keeper value "$5" must be a whole number.',
        mention: "$5",
      },
    });
  });

  it("rejects an unsafe auction integer", () => {
    const result = parseKeeperCommand(auctionCommandInput(
      "owner01 keeping dart 999999999999999999999",
    ));

    expect(result).toMatchObject({
      kind: "error",
      error: {
        code: "invalid_value",
        message: "Auction keeper cost must be a non-negative whole number.",
      },
    });
  });

  it("returns an explicit unknown-team error", () => {
    expect(parseKeeperCommand(snakeCommandInput("nobody keeping dart 2"))).toEqual({
      kind: "error",
      error: {
        code: "unknown_team",
        message: 'No team or manager matched "nobody".',
        mention: "nobody",
      },
    });
  });

  it("returns an explicit unknown-player error", () => {
    expect(parseKeeperCommand(snakeCommandInput("owner01 keeping missing 2"))).toEqual({
      kind: "error",
      error: {
        code: "unknown_player",
        message: 'No player matched "missing".',
        mention: "missing",
      },
    });
  });

  it("rejects zero as a snake keeper round", () => {
    expect(parseKeeperCommand(snakeCommandInput("owner01 keeping dart 0"))).toEqual({
      kind: "error",
      error: {
        code: "invalid_value",
        message: "Snake keeper round must be a positive whole number.",
        mention: "0",
      },
    });
  });

  it("rejects auction costs below the league minimum bid", () => {
    const input = auctionCommandInput("owner01 keeping dart 2");
    const result = parseKeeperCommand({ ...input, auctionMinimumBidDollars: 3 });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "invalid_value",
        message: "Auction keeper cost must be at least $3.",
        mention: "2",
      },
    });
  });

  it("rejects snake rounds beyond the configured draft", () => {
    const input = snakeCommandInput("owner01 keeping dart 3");
    const result = parseKeeperCommand({ ...input, snakeRoundCount: 2 });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "invalid_value",
        message: "Snake keeper round must be between 1 and 2.",
        mention: "3",
      },
    });
  });
});
