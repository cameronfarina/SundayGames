import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  FantasyProsRequestError,
  createFantasyProsClient,
  isFantasyProsThrottled,
  parseFantasyProsPlayers,
  parseFantasyProsProjections,
  parseFantasyProsRankings,
} from "../src/data/fantasyPros.js";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/fantasyPros", name), "utf8"));

type FetchArguments = [url: string, init: RequestInit];

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("FantasyPros response parsing", () => {
  it("reads consensus rankings, coercing the quoted numeric fields", () => {
    const set = parseFantasyProsRankings(fixture("rankings-weekly.json"), {
      type: "weekly",
      scoring: "PPR",
      week: 1,
    });

    expect(set.type).toBe("weekly");
    expect(set.scoring).toBe("PPR");
    expect(set.week).toBe(1);
    expect(set.rankings[0]).toEqual({
      playerId: 22968,
      playerName: "Jahmyr Gibbs",
      position: "RB",
      teamAbbreviation: "DET",
      yahooId: "40059",
      rankEcr: 1,
      rankMin: 1,
      rankMax: 2,
      rankAverage: 1.2,
      rankStandardDeviation: 0.4,
      tier: undefined,
      positionRank: "RB1",
      byeWeek: 6,
      ecrDelta: undefined,
      ownedAverage: 99.5,
      ownedEspn: 99.9,
      ownedYahoo: 100,
    });
  });

  it("keeps kickers and defenses out of the weekly set but inside the rest-of-season set", () => {
    const weekly = parseFantasyProsRankings(fixture("rankings-weekly.json"), {
      type: "weekly",
      scoring: "PPR",
      week: 1,
    });
    const restOfSeason = parseFantasyProsRankings(fixture("rankings-ros.json"), {
      type: "ros",
      scoring: "PPR",
      week: 0,
    });

    // position=ALL answers with FLEX for weekly rankings; only the
    // rest-of-season set carries every position.
    expect(weekly.rankings.some(ranking => ranking.position === "K" || ranking.position === "DST"))
      .toBe(false);
    expect(new Set(restOfSeason.rankings.map(ranking => ranking.position)))
      .toEqual(new Set(["QB", "RB", "WR", "TE", "K", "DST"]));
    const defense = restOfSeason.rankings.find(ranking => ranking.position === "DST");
    expect(defense).toMatchObject({ playerName: "Houston Texans", teamAbbreviation: "HOU", tier: 10 });
  });

  it("returns an empty ranking set for the pre-season waiver response", () => {
    const set = parseFantasyProsRankings(
      { sport: "NFL", count: 0, players: [], public_api_limited: true },
      { type: "waiver", scoring: "PPR", week: 1 },
    );

    expect(set).toEqual({ type: "waiver", scoring: "PPR", week: 1, rankings: [] });
  });

  it("reads projections from the nested stats object", () => {
    const set = parseFantasyProsProjections(fixture("projections-qb-week1.json"), {
      position: "QB",
      week: 1,
    });

    expect(set.week).toBe(1);
    expect(set.projections[0]).toEqual({
      playerId: 19275,
      playerName: "Jalen Hurts",
      position: "QB",
      teamAbbreviation: "PHI",
      points: 20.28,
      pointsPpr: 20.28,
      passingYards: 221.87,
      passingTouchdowns: 1.55,
      interceptions: 0.54,
      rushingYards: 27.81,
      rushingTouchdowns: 0.56,
      receptions: undefined,
      receivingYards: undefined,
      receivingTouchdowns: undefined,
    });
  });

  it("reads receiving lines from rest-of-season projections", () => {
    const set = parseFantasyProsProjections(fixture("projections-ros-rb.json"), {
      position: "RB",
      week: 0,
    });

    expect(set.week).toBe(0);
    expect(set.projections[0]).toMatchObject({
      playerId: 22968,
      playerName: "Jahmyr Gibbs",
      pointsPpr: 372.92,
      receptions: 71.27,
      receivingYards: 580.98,
    });
  });

  it("reads the player catalog, including defenses as team entities", () => {
    const players = parseFantasyProsPlayers(fixture("players.json"));
    const defense = players.find(player => player.playerName === "Houston Texans");

    expect(players.length).toBeGreaterThan(0);
    expect(defense).toEqual({
      playerId: 8120,
      playerName: "Houston Texans",
      firstName: "Houston",
      lastName: "Texans",
      shortName: "Houston",
      position: "DST",
      positions: ["DST"],
      teamAbbreviation: "HOU",
      sportsDataId: "82d2d380-3834-4938-835f-aec541e5ece7",
    });
  });

  it("drops records that are missing an identifier instead of throwing", () => {
    const payload = {
      players: [
        { player_name: "No Identifier", rank_ecr: 4 },
        { player_id: 1, rank_ecr: 5 },
        { player_id: 2, player_name: "Kept Player", rank_ecr: 6 },
      ],
    };

    const set = parseFantasyProsRankings(payload, { type: "ros", scoring: "PPR", week: 0 });

    expect(set.rankings.map(ranking => ranking.playerName)).toEqual(["Kept Player"]);
  });

  it("tolerates a payload that is not the expected envelope", () => {
    expect(parseFantasyProsPlayers(null).length).toBe(0);
    expect(parseFantasyProsPlayers({ players: "unexpected" }).length).toBe(0);
    expect(parseFantasyProsProjections([], { position: "K", week: 3 }).projections).toEqual([]);
  });
});

describe("FantasyPros client requests", () => {
  it("sends the API key as a header and asks for the current week implicitly", async () => {
    const fetchImplementation = vi.fn(
      async (..._request: FetchArguments) => jsonResponse(fixture("rankings-weekly.json")),
    );
    const client = createFantasyProsClient({
      apiKey: "test-key",
      season: 2026,
      fetchImplementation,
    });

    const set = await client.fetchRankings({ type: "weekly" });

    expect(set.rankings.length).toBe(8);
    const [url, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.fantasypros.com/public/v2/json/nfl/2026/consensus-rankings?position=ALL&type=weekly&scoring=PPR",
    );
    expect(init?.headers).toMatchObject({ "x-api-key": "test-key" });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("requests projections per position and week", async () => {
    const fetchImplementation = vi.fn(
      async (..._request: FetchArguments) => jsonResponse(fixture("projections-ros-rb.json")),
    );
    const client = createFantasyProsClient({
      apiKey: "test-key",
      season: 2026,
      fetchImplementation,
    });

    await client.fetchProjections({ position: "RB", week: 0 });

    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      "https://api.fantasypros.com/public/v2/json/nfl/2026/projections?position=RB&week=0&scoring=PPR",
    );
  });

  it("requests the player catalog without a season segment", async () => {
    const fetchImplementation = vi.fn(
      async (..._request: FetchArguments) => jsonResponse(fixture("players.json")),
    );
    const client = createFantasyProsClient({ apiKey: "test-key", fetchImplementation });

    const players = await client.fetchPlayers();

    expect(players.length).toBeGreaterThan(0);
    expect(fetchImplementation.mock.calls[0]?.[0])
      .toBe("https://api.fantasypros.com/public/v2/json/nfl/players?");
  });

  it("fails loudly when a full payload parses to nothing", async () => {
    // A renamed identifier field would otherwise store zero rows and look
    // like an empty dataset, which is how a silent outage hides.
    const renamedIdentifier = {
      season: "2026",
      week: "0",
      count: "2",
      players: [
        { player_ref: 1, name: "First Player", position_id: "RB", stats: { points_ppr: 10 } },
        { player_ref: 2, name: "Second Player", position_id: "RB", stats: { points_ppr: 9 } },
      ],
    };
    const client = createFantasyProsClient({
      apiKey: "test-key",
      fetchImplementation: async (..._request: FetchArguments) => jsonResponse(renamedIdentifier),
    });

    await expect(client.fetchProjections({ position: "RB", week: 0 })).rejects.toThrow(
      "FantasyPros week 0 RB projections returned 2 records but none could be parsed.",
    );
  });

  it("stays quiet when the payload is genuinely empty", async () => {
    // Waiver rankings are legitimately empty pre-season; that is not a defect.
    const client = createFantasyProsClient({
      apiKey: "test-key",
      fetchImplementation: async (..._request: FetchArguments) =>
        jsonResponse({ sport: "NFL", count: 0, players: [], public_api_limited: true }),
    });

    await expect(client.fetchRankings({ type: "waiver" }))
      .resolves.toMatchObject({ type: "waiver", rankings: [] });
  });

  it("fails loudly when the player catalog parses to nothing", async () => {
    const client = createFantasyProsClient({
      apiKey: "test-key",
      fetchImplementation: async (..._request: FetchArguments) =>
        jsonResponse({ count: 1, players: [{ name: "No Identifier", position_id: "WR" }] }),
    });

    await expect(client.fetchPlayers())
      .rejects.toThrow("FantasyPros player catalog returned 1 records but none could be parsed.");
  });

  it("fails loudly on a non-OK response", async () => {
    const client = createFantasyProsClient({
      apiKey: "test-key",
      fetchImplementation: async () => new Response("nope", { status: 403 }),
    });

    await expect(client.fetchPlayers())
      .rejects.toThrow("FantasyPros request to /nfl/players failed with 403.");
  });

  it("carries the status on the error, not only inside the message", async () => {
    // The refresh has to tell a rate refusal apart from an outage, and a
    // status buried in prose is not something it can branch on.
    const client = createFantasyProsClient({
      apiKey: "test-key",
      fetchImplementation: async () => new Response("slow down", { status: 429 }),
    });

    await expect(client.fetchPlayers()).rejects.toBeInstanceOf(FantasyProsRequestError);
    const error = await client.fetchPlayers().catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ status: 429 });
    expect(isFantasyProsThrottled(error)).toBe(true);
  });

  it("counts only a real 429 as throttled", () => {
    expect(isFantasyProsThrottled(new FantasyProsRequestError("/nfl/players", 500))).toBe(false);
    expect(isFantasyProsThrottled(new Error("failed with 429"))).toBe(false);
    expect(isFantasyProsThrottled(undefined)).toBe(false);
  });
});
