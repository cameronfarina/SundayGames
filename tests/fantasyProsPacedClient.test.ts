import { describe, expect, it } from "vitest";
import {
  fantasyProsRequestSpacingMs,
  pacedFantasyProsClient,
  type FantasyProsClient,
} from "../src/data/fantasyPros.js";

const emptyClient = (record: (label: string) => void): FantasyProsClient => ({
  fetchRankings: async ({ type }) => {
    record(`rankings:${type}`);
    return { type, scoring: "PPR", week: 0, rankings: [] };
  },
  fetchProjections: async ({ position, week }) => {
    record(`projections:${position}`);
    return { position, week, projections: [] };
  },
  fetchPlayers: async () => {
    record("players");
    return [];
  },
  fetchNews: async () => {
    record("news");
    return [];
  },
});

/** A clock that only moves when the paced client waits, so a test never sleeps. */
const fakeClock = () => {
  let current = 1_000;
  const waits: number[] = [];
  return {
    waits,
    advance: (ms: number) => { current += ms; },
    now: () => current,
    delay: async (ms: number) => {
      waits.push(ms);
      current += ms;
    },
  };
};

describe("paced FantasyPros client", () => {
  it("spaces consecutive requests by the configured gap", async () => {
    const clock = fakeClock();
    const calls: string[] = [];
    const client = pacedFantasyProsClient(emptyClient(label => calls.push(label)), {
      spacingMs: 3_000,
      now: clock.now,
      delay: clock.delay,
    });

    await client.fetchRankings({ type: "weekly" });
    await client.fetchRankings({ type: "ros" });
    await client.fetchPlayers();

    expect(calls).toEqual(["rankings:weekly", "rankings:ros", "players"]);
    // The first request goes straight out; only the two after it wait.
    expect(clock.waits).toEqual([3_000, 3_000]);
  });

  it("paces the projection positions inside a single dataset", async () => {
    // The boot burst is mostly projections: six positions back to back, which
    // is the shape a per-minute limit refuses.
    const clock = fakeClock();
    const client = pacedFantasyProsClient(emptyClient(() => {}), {
      spacingMs: 3_000,
      now: clock.now,
      delay: clock.delay,
    });

    for (const position of ["QB", "RB", "WR", "TE", "K", "DST"] as const) {
      await client.fetchProjections({ position, week: 1 });
    }

    expect(clock.waits).toEqual([3_000, 3_000, 3_000, 3_000, 3_000]);
  });

  it("waits only the remainder when the caller was already slow", async () => {
    const clock = fakeClock();
    const client = pacedFantasyProsClient(emptyClient(() => {}), {
      spacingMs: 3_000,
      now: clock.now,
      delay: clock.delay,
    });

    await client.fetchPlayers();
    clock.advance(2_000);
    await client.fetchNews();

    expect(clock.waits).toEqual([1_000]);
  });

  it("does not wait at all when the gap has already elapsed", async () => {
    const clock = fakeClock();
    const client = pacedFantasyProsClient(emptyClient(() => {}), {
      spacingMs: 3_000,
      now: clock.now,
      delay: clock.delay,
    });

    await client.fetchPlayers();
    clock.advance(10_000);
    await client.fetchNews();

    expect(clock.waits).toEqual([]);
  });

  it("ships a spacing that leaves the boot pass well inside a minute", () => {
    // Seventeen requests at this gap is under a minute of boot pacing, which
    // is the trade: a slower first pass, nothing else waiting on it.
    expect(fantasyProsRequestSpacingMs).toBeGreaterThan(0);
    expect(fantasyProsRequestSpacingMs * 17).toBeLessThanOrEqual(60_000);
  });
});
