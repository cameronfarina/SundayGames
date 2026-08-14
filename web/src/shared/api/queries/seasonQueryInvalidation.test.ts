import { QueryClient, QueryObserver, type QueryKey } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import {
  invalidateKeeperConsumers,
  invalidateLeagueSetupConsumers,
  invalidateLiveRoomConsumers,
  invalidatePublishedSeasonConsumers,
} from "./seasonQueryInvalidation";
import { seasonQueryKeys } from "./seasonQueryKeys";

interface ActiveQuery {
  readonly calls: () => number;
  readonly unsubscribe: () => void;
}

const activeQueries: ActiveQuery[] = [];

const activate = async (client: QueryClient, queryKey: QueryKey): Promise<ActiveQuery> => {
  let calls = 0;
  const queryFn = () => {
    calls += 1;
    return Promise.resolve(calls);
  };
  const options = { queryFn, queryKey, staleTime: Infinity };
  await client.prefetchQuery(options);
  const observer = new QueryObserver(client, options);
  const active = { calls: () => calls, unsubscribe: observer.subscribe(() => undefined) };
  activeQueries.push(active);
  return active;
};

describe("season query invalidation", () => {
  afterEach(() => { activeQueries.splice(0).forEach(query => { query.unsubscribe(); }); });

  it("refreshes keeper consumers once while leaving another season warm", async () => {
    const client = new QueryClient();
    const affected = await Promise.all([
      activate(client, seasonQueryKeys.commissionerKeepers("season-a")),
      activate(client, seasonQueryKeys.seasonKeepers("season-a")),
      activate(client, seasonQueryKeys.practiceCatalog("season-a", "balanced")),
      activate(client, seasonQueryKeys.practiceCatalog("season-a", "stars-and-scrubs")),
    ]);
    const otherSeason = await activate(client, seasonQueryKeys.seasonKeepers("season-b"));

    await invalidateKeeperConsumers(client, "season-a");

    expect(affected.map(query => query.calls())).toEqual([2, 2, 2, 2]);
    expect(otherSeason.calls()).toBe(1);
  });

  it("refreshes every team-setup consumer once", async () => {
    const client = new QueryClient();
    const affected = await Promise.all([
      activate(client, seasonQueryKeys.onboarding()),
      activate(client, seasonQueryKeys.commissionerSeason("season-a")),
      activate(client, seasonQueryKeys.leagueSeason("season-a")),
      activate(client, seasonQueryKeys.seasonTeam("season-a")),
      activate(client, seasonQueryKeys.commissionerInvitations("season-a")),
      activate(client, seasonQueryKeys.commissionerKeepers("season-a")),
      activate(client, seasonQueryKeys.seasonKeepers("season-a")),
      activate(client, seasonQueryKeys.practiceCatalog("season-a", "balanced")),
    ]);

    await invalidateLeagueSetupConsumers(client, "season-a");

    expect(affected.map(query => query.calls())).toEqual([2, 2, 2, 2, 2, 2, 2, 2]);
  });

  it("refreshes room and publish consumers without duplicate refetches", async () => {
    const client = new QueryClient();
    const roomConsumers = await Promise.all([
      activate(client, seasonQueryKeys.onboarding()),
      activate(client, seasonQueryKeys.commissionerSeason("season-a")),
      activate(client, seasonQueryKeys.leagueSeason("season-a")),
    ]);
    await invalidateLiveRoomConsumers(client, "season-a");
    expect(roomConsumers.map(query => query.calls())).toEqual([2, 2, 2]);

    const publishedTeam = await activate(client, seasonQueryKeys.seasonTeam("season-a"));
    await invalidatePublishedSeasonConsumers(client, "season-a");
    expect(roomConsumers.every(query => query.calls() === 3)).toBe(true);
    expect(publishedTeam.calls()).toBe(2);
  });
});
