import { describe, expect, it } from "vitest";

import type { LeagueConnection, StoredLeagueSnapshot } from "../src/platform/leagueConnections.js";
import { confirmedSetupFromSyncedLeague } from "../src/platform/leagueSyncImport.js";

const connection: LeagueConnection = {
  id: "connection-1",
  accountId: "account-1",
  provider: "espn",
  providerLeagueId: "899513",
  season: "2026",
  displayName: "Imported League",
  status: "ok",
  createdAt: "2026-08-20T00:00:00.000Z",
  updatedAt: "2026-08-20T00:00:00.000Z",
};

const completeSnapshot = (): StoredLeagueSnapshot => ({
  connectionId: connection.id,
  syncedAt: "2026-08-20T00:00:00.000Z",
  settings: {
    name: "Imported League",
    season: "2026",
    teamCount: 2,
    rosterPositions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
    scoring: {
      pass_yd: 0.04,
      pass_td: 4,
      rush_yd: 0.1,
      rush_td: 6,
      rec_yd: 0.1,
      rec_td: 6,
      rec: 1,
    },
    draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
    keeperLeague: false,
  },
  teams: [
    {
      providerTeamId: "1",
      name: "First Team",
      ownerNames: ["Alice"],
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      players: [],
    },
    {
      providerTeamId: "2",
      name: "Second Team",
      ownerNames: ["Bob"],
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      players: [],
    },
  ],
  matchups: [],
});

const withSettings = (
  update: (settings: StoredLeagueSnapshot["settings"]) => StoredLeagueSnapshot["settings"],
): StoredLeagueSnapshot => {
  const snapshot = completeSnapshot();
  return { ...snapshot, settings: update(snapshot.settings) };
};

describe("synced league setup translation", () => {
  it("converts complete provider settings into confirmed league creation input", () => {
    const result = confirmedSetupFromSyncedLeague(connection, completeSnapshot());

    expect(result).toMatchObject({
      status: "ready",
      setup: {
        provider: "espn",
        externalLeagueId: "899513",
        leagueName: "Imported League",
        seasonYear: 2026,
        expectedTeamCount: 2,
        keeperLeague: false,
        draft: { type: "auction", budgetDollars: 200, minimumBidDollars: 1 },
        scoring: {
          passingYards: 0.04,
          passingTouchdown: 4,
          rushingYards: 0.1,
          rushingTouchdown: 6,
          receivingYards: 0.1,
          receivingTouchdown: 6,
          reception: 1,
        },
        rosterSlots: { QB: 1, RB: 1, WR: 1, TE: 1, FLEX: 1, BENCH: 1 },
      },
    });
  });

  it("requires draft settings before creating a league", () => {
    const snapshot = withSettings(settings => ({ ...settings, draft: undefined }));
    expect(confirmedSetupFromSyncedLeague(connection, snapshot))
      .toMatchObject({ status: "needs_attention" });
  });

  it("requires keeper settings before creating a league", () => {
    const snapshot = withSettings(settings => ({ ...settings, keeperLeague: undefined }));
    expect(confirmedSetupFromSyncedLeague(connection, snapshot))
      .toMatchObject({ status: "needs_attention" });
  });

  it("requires complete scoring settings before creating a league", () => {
    const snapshot = withSettings(settings => ({
      ...settings,
      scoring: { pass_yd: 0.04, rush_yd: 0.1, rush_td: 6, rec_yd: 0.1, rec_td: 6, rec: 1 },
    }));
    expect(confirmedSetupFromSyncedLeague(connection, snapshot))
      .toMatchObject({ status: "needs_attention" });
  });

  it("rejects a snake order that references a team the provider did not return", () => {
    const snapshot = withSettings(settings => ({
      ...settings,
      draft: { type: "snake", rounds: 6, order: ["1", "missing"] },
    }));

    expect(confirmedSetupFromSyncedLeague(connection, snapshot)).toEqual({
      status: "needs_attention",
      message: "The provider draft order does not match the imported teams.",
    });
  });
});
