import { describe, expect, it } from "vitest";
import { parseKeeperCommand } from "../src/platform/keeperCommandImport.js";
import { auctionCommandInput, dartPlayer, snakeCommandInput } from "./keeperCommandImportFixtures.js";

describe("keeper command matching", () => {
  it("returns every candidate for an ambiguous player surname", () => {
    const result = parseKeeperCommand(snakeCommandInput(
      "owner01 keeping dart 2",
      undefined,
      [
        { playerId: "player-jaxson-dart", name: "Jaxson Dart" },
        { playerId: "player-ian-dart", name: "Ian Dart" },
      ],
    ));

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "ambiguous_player",
        message: '"dart" matched multiple players.',
        mention: "dart",
        candidates: ["Jaxson Dart", "Ian Dart"],
      },
    });
  });

  it("returns every team for an ambiguous manager mention", () => {
    const result = parseKeeperCommand(snakeCommandInput(
      "owner01 keeping dart 2",
      [
        { teamId: "team-jamie", teamName: "Jamie's Team", managerNames: ["Jamie Owner01"] },
        { teamId: "team-alex", teamName: "Alex's Team", managerNames: ["Alex Owner01"] },
      ],
    ));

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "ambiguous_team",
        message: '"owner01" matched multiple teams or managers.',
        mention: "owner01",
        candidates: ["Jamie's Team", "Alex's Team"],
      },
    });
  });

  it("matches an unambiguous manager-name prefix", () => {
    const result = parseKeeperCommand(snakeCommandInput(
      "mar keeping dart 2",
      [
        { teamId: "team-maren", teamName: "Rock Out", managerNames: ["Maren Rubino"] },
        { teamId: "team-owner11", teamName: "Short King", managerNames: ["Owner11 Manager"] },
      ],
    ));

    expect(result).toMatchObject({ kind: "preview", team: { id: "team-maren" } });
  });

  it("keeps a shared manager-name prefix ambiguous", () => {
    const result = parseKeeperCommand(snakeCommandInput(
      "mar keeping dart 2",
      [
        { teamId: "team-maren", teamName: "Rock Out", managerNames: ["Maren Rubino"] },
        { teamId: "team-marcus", teamName: "Marcus Team", managerNames: ["Marcus Smith"] },
      ],
    ));

    expect(result).toMatchObject({
      kind: "error",
      error: { code: "ambiguous_team", candidates: ["Rock Out", "Marcus Team"] },
    });
  });

  it("matches a player by a unique first name", () => {
    const result = parseKeeperCommand(auctionCommandInput(
      "owner01 keeping jameson 5",
      undefined,
      [
        { playerId: "player-jameson", name: "Jameson Williams" },
        { playerId: "player-rhamondre", name: "Rhamondre Stevenson" },
      ],
    ));

    expect(result).toMatchObject({ kind: "preview", player: { id: "player-jameson" } });
  });

  it("matches a player by a unique first-name prefix", () => {
    const result = parseKeeperCommand(auctionCommandInput(
      "owner01 keeping rhamond 3",
      undefined,
      [
        { playerId: "player-rhamondre", name: "Rhamondre Stevenson" },
        { playerId: "player-jameson", name: "Jameson Williams" },
      ],
    ));

    expect(result).toMatchObject({ kind: "preview", player: { id: "player-rhamondre" } });
  });

  it("keeps a shared first name ambiguous", () => {
    const result = parseKeeperCommand(auctionCommandInput(
      "owner01 keeping josh 5",
      undefined,
      [
        { playerId: "player-josh-allen", name: "Josh Allen" },
        { playerId: "player-josh-jacobs", name: "Josh Jacobs" },
      ],
    ));

    expect(result).toMatchObject({
      kind: "error",
      error: { code: "ambiguous_player", candidates: ["Josh Allen", "Josh Jacobs"] },
    });
  });

  it("prefers an exact first name over a longer prefix", () => {
    const result = parseKeeperCommand(auctionCommandInput(
      "owner01 keeping james 5",
      undefined,
      [
        { playerId: "player-james", name: "James Cook" },
        { playerId: "player-jameson", name: "Jameson Williams" },
      ],
    ));

    expect(result).toMatchObject({ kind: "preview", player: { id: "player-james" } });
  });

  it("does not prefix-match mentions shorter than three characters", () => {
    const result = parseKeeperCommand(snakeCommandInput(
      "ma keeping dart 2",
      [{ teamId: "team-maren", teamName: "Rock Out", managerNames: ["Maren Rubino"] }],
      [dartPlayer],
    ));

    expect(result).toMatchObject({ kind: "error", error: { code: "unknown_team" } });
  });
});
