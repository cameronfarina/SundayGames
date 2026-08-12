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

  it("matches an unambiguous manager-name prefix", () => {
    const result = parseKeeperCommand({
      command: "ken keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-kenny",
          teamName: "Rock Out",
          managerNames: ["Kenny Rubino"],
        },
        {
          teamId: "team-cam",
          teamName: "Short King",
          managerNames: ["Cam Farina"],
        },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toMatchObject({
      kind: "preview",
      team: { id: "team-kenny", name: "Rock Out" },
    });
  });

  it("keeps a shared manager-name prefix ambiguous", () => {
    const result = parseKeeperCommand({
      command: "ken keeping dart 2",
      draftType: "snake",
      teams: [
        { teamId: "team-kenny", teamName: "Rock Out", managerNames: ["Kenny Rubino"] },
        { teamId: "team-kent", teamName: "Kent Team", managerNames: ["Kent Smith"] },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "ambiguous_team",
        message: '"ken" matched multiple teams or managers.',
        mention: "ken",
        candidates: ["Rock Out", "Kent Team"],
      },
    });
  });

  it("matches a player by a unique first name", () => {
    const result = parseKeeperCommand({
      command: "sam keeping jameson 5",
      draftType: "auction",
      teams: [
        { teamId: "team-sam", teamName: "Massage Envy", managerNames: ["Sam LaPlante"] },
      ],
      players: [
        { playerId: "player-jameson-williams", name: "Jameson Williams" },
        { playerId: "player-rhamondre-stevenson", name: "Rhamondre Stevenson" },
      ],
    });

    expect(result).toMatchObject({
      kind: "preview",
      player: { id: "player-jameson-williams", name: "Jameson Williams" },
    });
  });

  it("matches a player by a unique first-name prefix", () => {
    const result = parseKeeperCommand({
      command: "juice keeping rhamond 3",
      draftType: "auction",
      teams: [
        { teamId: "team-juice", teamName: "Old Dogs", managerNames: ["Juice"] },
      ],
      players: [
        { playerId: "player-rhamondre-stevenson", name: "Rhamondre Stevenson" },
        { playerId: "player-jameson-williams", name: "Jameson Williams" },
      ],
    });

    expect(result).toMatchObject({
      kind: "preview",
      player: { id: "player-rhamondre-stevenson", name: "Rhamondre Stevenson" },
    });
  });

  it("keeps a shared player first name ambiguous", () => {
    const result = parseKeeperCommand({
      command: "sam keeping josh 5",
      draftType: "auction",
      teams: [
        { teamId: "team-sam", teamName: "Massage Envy", managerNames: ["Sam LaPlante"] },
      ],
      players: [
        { playerId: "player-josh-allen", name: "Josh Allen" },
        { playerId: "player-josh-jacobs", name: "Josh Jacobs" },
      ],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "ambiguous_player",
        message: '"josh" matched multiple players.',
        mention: "josh",
        candidates: ["Josh Allen", "Josh Jacobs"],
      },
    });
  });

  it("prefers an exact player first name over a longer player's prefix", () => {
    const result = parseKeeperCommand({
      command: "sam keeping james 5",
      draftType: "auction",
      teams: [
        { teamId: "team-sam", teamName: "Massage Envy", managerNames: ["Sam LaPlante"] },
      ],
      players: [
        { playerId: "player-james-cook", name: "James Cook" },
        { playerId: "player-jameson-williams", name: "Jameson Williams" },
      ],
    });

    expect(result).toMatchObject({
      kind: "preview",
      player: { id: "player-james-cook", name: "James Cook" },
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
