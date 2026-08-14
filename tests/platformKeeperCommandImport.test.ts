import { describe, expect, it } from "vitest";
import { parseKeeperCommand } from "../src/platform/keeperCommandImport.js";

describe("parseKeeperCommand", () => {
  it("previews a natural auction keeper command against injected catalogs", () => {
    const result = parseKeeperCommand({
      command: "owner11 keeping achane 50",
      draftType: "auction",
      teams: [
        {
          teamId: "team-owner11",
          teamName: "Owner11's Heroes",
          managerNames: ["Owner11 Manager"],
        },
        {
          teamId: "team-owner01",
          teamName: "Owner01 FC",
          managerNames: ["Jamie Owner01"],
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
      sourceCommand: "owner11 keeping achane 50",
      team: {
        id: "team-owner11",
        name: "Owner11's Heroes",
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
      command: "owner01 keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-owner01",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Owner01"],
        },
      ],
      players: [
        { playerId: "player-dart", name: "Jaxson Dart" },
      ],
    });

    expect(result).toEqual({
      kind: "preview",
      confirmationRequired: true,
      sourceCommand: "owner01 keeping dart 2",
      team: {
        id: "team-owner01",
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
      command: "owner01 keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-owner01",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Owner01"],
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
      command: "owner01 keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-jamie",
          teamName: "Jamie's Team",
          managerNames: ["Jamie Owner01"],
        },
        {
          teamId: "team-alex",
          teamName: "Alex's Team",
          managerNames: ["Alex Owner01"],
        },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

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
    const result = parseKeeperCommand({
      command: "mar keeping dart 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-maren",
          teamName: "Rock Out",
          managerNames: ["Maren Rubino"],
        },
        {
          teamId: "team-owner11",
          teamName: "Short King",
          managerNames: ["Owner11 Manager"],
        },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toMatchObject({
      kind: "preview",
      team: { id: "team-maren", name: "Rock Out" },
    });
  });

  it("keeps a shared manager-name prefix ambiguous", () => {
    const result = parseKeeperCommand({
      command: "mar keeping dart 2",
      draftType: "snake",
      teams: [
        { teamId: "team-maren", teamName: "Rock Out", managerNames: ["Maren Rubino"] },
        { teamId: "team-marcus", teamName: "Marcus Team", managerNames: ["Marcus Smith"] },
      ],
      players: [{ playerId: "player-dart", name: "Jaxson Dart" }],
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "ambiguous_team",
        message: '"mar" matched multiple teams or managers.',
        mention: "mar",
        candidates: ["Rock Out", "Marcus Team"],
      },
    });
  });

  it("matches a player by a unique first name", () => {
    const result = parseKeeperCommand({
      command: "owner12 keeping jameson 5",
      draftType: "auction",
      teams: [
        { teamId: "team-owner12", teamName: "Team 12", managerNames: ["Owner12 Manager"] },
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
      command: "owner13 keeping rhamond 3",
      draftType: "auction",
      teams: [
        { teamId: "team-owner13", teamName: "Team 13", managerNames: ["Owner13 Manager"] },
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
      command: "owner12 keeping josh 5",
      draftType: "auction",
      teams: [
        { teamId: "team-owner12", teamName: "Team 12", managerNames: ["Owner12 Manager"] },
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
      command: "owner12 keeping james 5",
      draftType: "auction",
      teams: [
        { teamId: "team-owner12", teamName: "Team 12", managerNames: ["Owner12 Manager"] },
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
          teamId: "team-owner01",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Owner01"],
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
      command: "owner01 keeping missing 2",
      draftType: "snake",
      teams: [
        {
          teamId: "team-owner01",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Owner01"],
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
      command: "owner01 keeping dart 0",
      draftType: "snake",
      teams: [
        {
          teamId: "team-owner01",
          teamName: "Sunday Beaters",
          managerNames: ["Jamie Owner01"],
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
      command: "owner11 keeping achane 2",
      draftType: "auction",
      auctionMinimumBidDollars: 3,
      teams: [{
        teamId: "team-owner11",
        teamName: "Owner11's Heroes",
        managerNames: ["Owner11 Manager"],
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
      command: "owner01 keeping dart 3",
      draftType: "snake",
      snakeRoundCount: 2,
      teams: [{
        teamId: "team-owner01",
        teamName: "Sunday Beaters",
        managerNames: ["Jamie Owner01"],
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
