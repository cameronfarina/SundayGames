import { describe, expect, it } from "vitest";
import {
  importedConnectionFixture,
  syncedConnectionFixture,
} from "../api/leagueConnections.fixture";
import type { DiscoveredLeague } from "../api/leagueConnectionsSchema";
import {
  discoveredLeagueKey,
  importStateFromConnections,
  importStateLabel,
  isImportRunning,
} from "./discoveredLeagueState";

const sleeperLeague: DiscoveredLeague = {
  providerLeagueId: syncedConnectionFixture.providerLeagueId,
  name: "Sleeper Friends League",
  season: "2026",
  teamCount: 12,
};

describe("discoveredLeagueKey", () => {
  it("separates the same league in two different seasons", () => {
    expect(discoveredLeagueKey(sleeperLeague))
      .not.toBe(discoveredLeagueKey({ ...sleeperLeague, season: "2025" }));
  });
});

describe("isImportRunning", () => {
  it("counts both halves of an import as work in progress", () => {
    expect(isImportRunning({ status: "connecting" })).toBe(true);
    expect(isImportRunning({ status: "importing" })).toBe(true);
    expect(isImportRunning({ status: "idle" })).toBe(false);
  });
});

describe("importStateLabel", () => {
  it("gives every state a line a person can read", () => {
    expect(importStateLabel({ status: "idle" })).toBe("Ready to import");
    expect(importStateLabel({ status: "connecting" })).toBe("Connecting...");
    expect(importStateLabel({ status: "importing" })).toBe("Building your league...");
    expect(importStateLabel({ status: "imported" })).toBe("Imported into Sunday Games");
    expect(importStateLabel({ status: "connected" })).toBe("Connected, not imported yet");
  });

  it("prefers the server's own words for a failure", () => {
    expect(importStateLabel({ message: "Sync this league first.", status: "error" }))
      .toBe("Sync this league first.");
    expect(importStateLabel({ status: "error" })).toBe("Could not import this league.");
  });
});

describe("importStateFromConnections", () => {
  it("offers to import a league the account has never seen", () => {
    expect(importStateFromConnections([], sleeperLeague)).toEqual({ status: "idle" });
  });

  it("remembers a league that is connected but not imported", () => {
    expect(importStateFromConnections([syncedConnectionFixture], sleeperLeague))
      .toEqual({ status: "connected" });
  });

  it("points a finished import at the league it built", () => {
    expect(importStateFromConnections([importedConnectionFixture], sleeperLeague))
      .toEqual({ leagueSlug: "sleeper-friends-league", status: "imported" });
  });
});
