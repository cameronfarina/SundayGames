import { describe, expect, it } from "vitest";
import {
  InMemoryFantasyProsRepository,
  type SaveFantasyProsRankingsInput,
} from "../src/platform/fantasyPros.js";
import {
  buildFantasyProsInSeasonView,
  fantasyProsRosterView,
  loadFantasyProsInSeasonDataset,
  loadFantasyProsPlayerNewsIndex,
  type FantasyProsRosterSource,
} from "../src/platform/fantasyProsInSeason.js";
import {
  InMemoryPlayerNewsRepository,
  type SavePlayerNewsItemInput,
} from "../src/platform/playerNews.js";

const fetchedAt = "2026-09-17T09:00:00.000Z";
const now = new Date("2026-09-17T12:00:00.000Z");

const rostered: FantasyProsRosterSource["playerCatalog"] = [
  { name: "Puka Nacua", position: "WR", teamAbbreviation: "LAR" },
];

const available: FantasyProsRosterSource["playerCatalog"] = [
  { name: "Jalen Coker", position: "WR", teamAbbreviation: "CAR" },
  { name: "Tyler Shough", position: "QB", teamAbbreviation: "NO" },
];

const room: FantasyProsRosterSource = {
  playerCatalog: [...rostered, ...available],
  projection: { teams: [{ teamId: "team-1", ownerId: "owner-1", roster: rostered }] },
};

const restOfSeason: SaveFantasyProsRankingsInput = {
  rankingType: "ros",
  scoring: "PPR",
  week: 0,
  fetchedAt,
  rankings: [
    { playerId: 3, playerName: "Puka Nacua", position: "WR", teamAbbreviation: "LAR", rankEcr: 6, ownedEspn: 99 },
    { playerId: 10, playerName: "Jalen Coker", position: "WR", teamAbbreviation: "CAR", rankEcr: 127, ownedEspn: 37 },
    { playerId: 11, playerName: "Tyler Shough", position: "QB", teamAbbreviation: "NO", rankEcr: 125, ownedEspn: 41.3 },
  ],
};

const newsItem = (
  overrides: Partial<SavePlayerNewsItemInput> & Pick<SavePlayerNewsItemInput, "providerItemId">,
): SavePlayerNewsItemInput => ({
  provider: "fantasypros",
  title: "Coker draws first-team reps",
  summary: "",
  publishedAt: "2026-09-17T08:00:00.000Z",
  fetchedAt,
  tags: [],
  categories: ["News"],
  providerPlayerId: "10",
  ...overrides,
});

const viewFor = async (items: readonly SavePlayerNewsItemInput[]) => {
  const fantasyPros = new InMemoryFantasyProsRepository();
  await fantasyPros.saveRankings(restOfSeason);
  const newsRepository = new InMemoryPlayerNewsRepository();
  await newsRepository.saveItems(items);

  const rosterView = fantasyProsRosterView(room, "team-1", "owner-1");
  if (rosterView === undefined) throw new Error("Expected the fixture roster.");
  return buildFantasyProsInSeasonView({
    configured: true,
    teamId: "team-1",
    ownerId: "owner-1",
    rosterView,
    starterSlots: [],
    dataset: await loadFantasyProsInSeasonDataset(fantasyPros),
    news: await loadFantasyProsPlayerNewsIndex(newsRepository, now),
  });
};

const waiver = (
  view: Awaited<ReturnType<typeof viewFor>>,
  playerName: string,
) => view.waivers.players.find(player => player.playerName === playerName);

describe("FantasyPros news on the waiver board", () => {
  it("attaches the newest headline to the candidate it names", async () => {
    const view = await viewFor([newsItem({ providerItemId: "1" })]);

    expect(waiver(view, "Jalen Coker")?.news).toEqual({
      headline: "Coker draws first-team reps",
      publishedAt: "2026-09-17T08:00:00.000Z",
      injury: false,
    });
  });

  it("flags a report FantasyPros filed under its injury category", async () => {
    const view = await viewFor([newsItem({
      providerItemId: "1",
      title: "Coker leaves practice with a hamstring strain",
      categories: ["Commentary", "News", "Injury"],
    })]);

    expect(waiver(view, "Jalen Coker")?.news).toMatchObject({
      headline: "Coker leaves practice with a hamstring strain",
      injury: true,
    });
  });

  it("keeps one blurb per player, and the newest one wins", async () => {
    const view = await viewFor([
      newsItem({
        providerItemId: "2",
        title: "Coker returns to full practice",
        publishedAt: "2026-09-17T10:00:00.000Z",
      }),
      newsItem({
        providerItemId: "1",
        title: "Coker limited in practice",
        publishedAt: "2026-09-17T06:00:00.000Z",
      }),
    ]);

    expect(waiver(view, "Jalen Coker")?.news?.headline).toBe("Coker returns to full practice");
  });

  it("ignores an older report no matter which order the store returns them in", async () => {
    const view = await viewFor([
      newsItem({
        providerItemId: "1",
        title: "Coker limited in practice",
        publishedAt: "2026-09-17T06:00:00.000Z",
      }),
      newsItem({
        providerItemId: "2",
        title: "Coker returns to full practice",
        publishedAt: "2026-09-17T10:00:00.000Z",
      }),
    ]);

    expect(waiver(view, "Jalen Coker")?.news?.headline).toBe("Coker returns to full practice");
  });

  it("leaves RotoWire items out, because they carry no FantasyPros player id", async () => {
    const view = await viewFor([
      newsItem({ providerItemId: "rotowire-1", provider: "rotowire-rss" }),
      newsItem({ providerItemId: "unattributed", providerPlayerId: undefined }),
    ]);

    expect(waiver(view, "Jalen Coker")?.news).toBeUndefined();
  });

  it("leaves a candidate FantasyPros published nothing about without a blurb", async () => {
    const view = await viewFor([newsItem({ providerItemId: "1" })]);

    expect(waiver(view, "Tyler Shough")?.news).toBeUndefined();
  });

  it("falls back to the fetch stamp when FantasyPros published no timestamp", async () => {
    const view = await viewFor([newsItem({ providerItemId: "1", publishedAt: undefined })]);

    expect(waiver(view, "Jalen Coker")?.news?.publishedAt).toBe(fetchedAt);
  });

  it("drops a report older than the news retention window", async () => {
    const view = await viewFor([newsItem({
      providerItemId: "1",
      publishedAt: "2026-09-01T08:00:00.000Z",
    })]);

    expect(waiver(view, "Jalen Coker")?.news).toBeUndefined();
  });
});

describe("FantasyPros news on the roster", () => {
  it("attaches the same blurb to a player the reader already rosters", async () => {
    const view = await viewFor([newsItem({
      providerItemId: "3",
      title: "Nacua is questionable for Sunday",
      categories: ["News", "Injury"],
      providerPlayerId: "3",
    })]);

    expect(view.players.find(player => player.playerName === "Puka Nacua")?.news).toMatchObject({
      headline: "Nacua is questionable for Sunday",
      injury: true,
    });
  });

  it("sends no blurb at all when no news repository is wired up", async () => {
    const fantasyPros = new InMemoryFantasyProsRepository();
    await fantasyPros.saveRankings(restOfSeason);
    const rosterView = fantasyProsRosterView(room, "team-1", "owner-1");
    if (rosterView === undefined) throw new Error("Expected the fixture roster.");

    const view = buildFantasyProsInSeasonView({
      configured: true,
      teamId: "team-1",
      ownerId: "owner-1",
      rosterView,
      starterSlots: [],
      dataset: await loadFantasyProsInSeasonDataset(fantasyPros),
    });

    expect(view.players.every(player => player.news === undefined)).toBe(true);
    expect(view.waivers.players.every(player => player.news === undefined)).toBe(true);
  });
});
