import { describe, expect, it } from "vitest";
import { parseKeeperCommand } from "../src/platform/keeperCommandImport.js";

describe("parseKeeperCommand", () => {
  it("previews a natural auction keeper command against injected catalogs", () => {
    const result = parseKeeperCommand({
      command: "cam keeping achane 50",
      draftType: "auction",
      teams: [
        {
          teamId: "team-cam",
          teamName: "Cam's Heroes",
          managerNames: ["Cam Farina"],
        },
        {
          teamId: "team-beaton",
          teamName: "Beaton FC",
          managerNames: ["Jamie Beaton"],
        },
      ],
      players: [
        { playerId: "player-achane", name: "De'Von Achane" },
        { playerId: "player-dart", name: "Jaxson Dart" },
      ],
    });

    expect(result).toEqual({
      kind: "preview",
      confirmationRequired: true,
      sourceCommand: "cam keeping achane 50",
      team: {
        id: "team-cam",
        name: "Cam's Heroes",
      },
      player: {
        id: "player-achane",
        name: "De'Von Achane",
      },
      keeper: {
        draftType: "auction",
        auctionCostDollars: 50,
      },
    });
  });

  it("previews the trailing number as a keeper round for a snake league", () => {
    const result = parseKeeperCommand({
      command: "beaton keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-beaton",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Beaton"],
        },
      ],
      players: [
        { playerId: "player-dart", name: "Jaxson Dart" },
      ],
    });

    expect(result).toEqual({
      kind: "preview",
      confirmationRequired: true,
      sourceCommand: "beaton keeping dart 2",
      team: {
        id: "team-beaton",
        name: "Sunday Beaters",
      },
      player: {
        id: "player-dart",
        name: "Jaxson Dart",
      },
      keeper: {
        draftType: "snake",
        keeperRound: 2,
      },
    });
  });

  it("returns every candidate when a player mention is ambiguous", () => {
    const result = parseKeeperCommand({
      command: "beaton keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-beaton",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Beaton"],
        },
      ],
      players: [
        { playerId: "player-jaxson-dart", name: "Jaxson Dart" },
        { playerId: "player-ian-dart", name: "Ian Dart" },
      ],
    });

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

  it("returns every team when a manager mention is ambiguous", () => {
    const result = parseKeeperCommand({
      command: "beaton keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-jamie",
          teamName: "Jamie's Team",
          managerNames: ["Jamie Beaton"],
        },
        {
          teamId: "team-alex",
          teamName: "Alex's Team",
          managerNames: ["Alex Beaton"],
        },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "ambiguous_team",
        message: '"beaton" matched multiple teams or managers.',
        mention: "beaton",
        candidates: ["Jamie's Team", "Alex's Team"],
      },
    });
  });

  it("returns an explicit unknown-team error", () => {
    const result = parseKeeperCommand({
      command: "nobody keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-beaton",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Beaton"],
        },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "unknown_team",
        message: 'No team or manager matched "nobody".',
        mention: "nobody",
      },
    });
  });

  it("returns an explicit unknown-player error", () => {
    const result = parseKeeperCommand({
      command: "beaton keeping missing 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-beaton",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Beaton"],
        },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "unknown_player",
        message: 'No player matched "missing".',
        mention: "missing",
      },
    });
  });

  it("rejects zero as a snake keeper round", () => {
    const result = parseKeeperCommand({
      command: "beaton keeping dart 0",
      draftType: "snake",
      teams: [
        {
          teamId: "team-beaton",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Beaton"],
        },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "invalid_value",
        message: "Snake keeper round must be a positive whole number.",
        mention: "0",
      },
    });
  });

  it("rejects auction costs below the league minimum bid", () => {
    const result = parseKeeperCommand({
      command: "cam keeping achane 2",
      draftType: "auction",
      auctionMinimumBidDollars: 3,
      teams: [{
        teamId: "team-cam",
        teamName: "Cam's Heroes",
        managerNames: ["Cam Farina"],
      }],
      players: [{ playerId: "player-achane", name: "De'Von Achane" }],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "invalid_value",
        message: "Auction keeper cost must be at least $3.",
        mention: "2",
      },
    });
  });

  it("rejects snake keeper rounds beyond the configured draft", () => {
    const result = parseKeeperCommand({
      command: "beaton keeping dart 3",
      draftType: "snake",
      snakeRoundCount: 2,
      teams: [{
        teamId: "team-beaton",
        teamName: "Sunday Beaters",
        managerNames: ["Jamie Beaton"],
      }],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

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
