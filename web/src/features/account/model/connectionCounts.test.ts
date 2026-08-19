import { describe, expect, it } from "vitest";
import {
  needsAttentionConnectionFixture,
  syncedConnectionFixture,
} from "../../leagueConnections/api/leagueConnections.fixture";
import type { LeagueConnection } from "../../leagueConnections/api/leagueConnectionsSchema";
import { connectionCounts } from "./connectionCounts";

const withStatus = (status: LeagueConnection["status"], id: string): LeagueConnection => ({
  ...syncedConnectionFixture,
  id,
  status,
});

describe("connectionCounts", () => {
  it("counts the synced leagues, the ones needing the owner, and the total", () => {
    expect(connectionCounts([syncedConnectionFixture, needsAttentionConnectionFixture]))
      .toEqual({ needsAttention: 1, synced: 1, total: 2 });
  });

  // Re-authenticating cannot fix a provider outage, so an error belongs in the
  // total but never in the bucket that asks the owner to act.
  it("keeps a provider-side error out of the attention count", () => {
    expect(connectionCounts([withStatus("error", "c1")]))
      .toEqual({ needsAttention: 0, synced: 0, total: 1 });
  });

  it("counts a league that has never synced in the total only", () => {
    expect(connectionCounts([withStatus("pending", "c1")]))
      .toEqual({ needsAttention: 0, synced: 0, total: 1 });
  });

  it("counts nothing for an account with no connections", () => {
    expect(connectionCounts([])).toEqual({ needsAttention: 0, synced: 0, total: 0 });
  });
});
