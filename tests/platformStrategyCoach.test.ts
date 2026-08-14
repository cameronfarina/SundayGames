import { describe, expect, it } from "vitest";
import {
  InMemoryStrategyCoachRepository,
  buildStrategyCoachPlan,
  createStrategyCoachService,
  type StrategyCoachPlayerCatalogEntry,
} from "../src/platform/strategyCoach.js";

const createdAt = new Date("2026-08-09T12:00:00.000Z");

const catalog = [
  { playerId: "jadarian-price", name: "Jadarian Price", position: "RB", price: 13 },
  { playerId: "breece-hall", name: "Breece Hall", position: "RB", price: 34 },
  { playerId: "kenneth-walker-iii", name: "Kenneth Walker III", position: "RB", price: 30 },
  { playerId: "chase-brown", name: "Chase Brown", position: "RB", price: 34 },
  { playerId: "ladd-mcconkey", name: "Ladd McConkey", position: "WR", recommendedMaxBid: 21 },
  { playerId: "davante-adams", name: "Davante Adams", position: "WR", recommendedMaxBid: 22 },
  { playerId: "zay-flowers", name: "Zay Flowers", position: "WR", recommendedMaxBid: 18 },
  { playerId: "tee-higgins", name: "Tee Higgins", position: "WR", recommendedMaxBid: 18 },
] satisfies readonly StrategyCoachPlayerCatalogEntry[];

const planInput = {
  userId: "user_cam",
  leagueId: "league_100001",
  seasonId: "season_2026",
  privateOwnerUserId: "user_cam",
  owner: {
    ownerId: "owner_cam",
    ownerName: "Owner11",
    teamId: "team_cam",
    teamName: "Sunday Games",
  },
  createdAt,
};

describe("strategy coach plan builder", () => {
  it("turns Jadarian RB3 plus RB2 alternatives and four WR targets into runnable variants", () => {
    const plan = buildStrategyCoachPlan({
      ...planInput,
      promptText:
        "draft Jadarian as RB3, for RB2 we need good but not great. thinking like... Breece Hall, Kenneth Walker, Chase Brown etc. for WRs find value with Ladd, Davante, Flowers, Higgins. I want 4 good WRs - nothing elite.",
      playerCatalog: catalog,
    });

    expect(plan).toMatchObject({
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "season_2026",
      privateOwnerUserId: "user_cam",
      promptText: expect.stringContaining("draft Jadarian as RB3"),
      owner: {
        ownerName: "Owner11",
        teamName: "Sunday Games",
      },
      extractedConstraints: {
        desiredWrCount: 4,
        avoidElite: true,
        valueIntent: true,
      },
      createdAt,
    });
    expect(plan.extractedConstraints.hardLocks).toEqual([
      expect.objectContaining({
        playerName: "Jadarian Price",
        position: "RB",
        slot: "RB3",
        price: 13,
      }),
    ]);
    expect(plan.extractedConstraints.rb2Alternatives.map(player => player.playerName)).toEqual([
      "Breece Hall",
      "Kenneth Walker III",
      "Chase Brown",
    ]);
    expect(plan.extractedConstraints.wrCandidates.map(player => player.playerName)).toEqual([
      "Ladd McConkey",
      "Davante Adams",
      "Zay Flowers",
      "Tee Higgins",
    ]);
    expect(plan.guardrails).toEqual([]);
    expect(plan.variants).toHaveLength(3);
    expect(plan.variants.map(variant => variant.name)).toEqual([
      "Breece Hall RB2 + value WRs",
      "Kenneth Walker III RB2 + value WRs",
      "Chase Brown RB2 + value WRs",
    ]);
    expect(plan.variants[1]).toMatchObject({
      runnable: true,
      commands: [
        "draft Jadarian Price for $13",
        "draft Kenneth Walker III for $30",
        "target Ladd McConkey max $21",
        "target Davante Adams max $22",
        "target Zay Flowers max $18",
        "target Tee Higgins max $18",
      ],
    });
  });

  it("applies no-player-over caps to target max bids without inventing new prices", () => {
    const plan = buildStrategyCoachPlan({
      ...planInput,
      promptText:
        "can you draft a team for me thats very balanced, no players over $40 besides my keeper. look to get great value on players. target Puka.",
      playerCatalog: [
        ...catalog,
        { playerId: "puka-nacua", name: "Puka Nacua", position: "WR", price: 73 },
      ],
    });

    expect(plan.extractedConstraints.globalMaxPrice).toBe(40);
    expect(plan.extractedConstraints.globalMaxExcludesKeeper).toBe(true);
    expect(plan.variants).toEqual([
      expect.objectContaining({
        runnable: true,
        commands: ["target Puka Nacua max $40"],
      }),
    ]);
    expect(plan.guardrails).toContainEqual(expect.objectContaining({
      code: "price_capped",
      severity: "warn",
      playerName: "Puka Nacua",
    }));
  });

  it("keeps coach plans private to the owner user", () => {
    const repository = new InMemoryStrategyCoachRepository();
    const service = createStrategyCoachService(repository);

    const { plan } = service.createPlanFromPrompt({
      ...planInput,
      promptText: "draft Jadarian as RB3; target Ladd max $21",
      playerCatalog: catalog,
    });

    expect(plan.extractedConstraints.globalMaxPrice).toBeUndefined();
    expect(service.getPlanForUser("user_cam", plan.id)?.id).toBe(plan.id);
    expect(service.listPlansForUser("user_cam", "league_100001", "season_2026")).toEqual([plan]);
    expect(service.getPlanForUser("user_sam", plan.id)).toBeNull();
    expect(service.listPlansForUser("user_sam", "league_100001", "season_2026")).toEqual([]);
    expect(service.getConversationForUser("user_sam", plan.conversationId ?? "")).toBeNull();
  });

  it("returns a blocking guardrail when a resolved player has no usable price", () => {
    const plan = buildStrategyCoachPlan({
      ...planInput,
      promptText: "draft Jadarian as RB3",
      playerCatalog: [
        { playerId: "jadarian-price", name: "Jadarian Price", position: "RB" },
      ],
    });

    expect(plan.extractedConstraints.hardLocks).toEqual([
      expect.objectContaining({
        playerName: "Jadarian Price",
        slot: "RB3",
      }),
    ]);
    expect(plan.extractedConstraints.hardLocks[0]?.price).toBeUndefined();
    expect(plan.guardrails).toContainEqual(expect.objectContaining({
      code: "missing_price",
      severity: "block",
      playerName: "Jadarian Price",
    }));
    expect(plan.variants).toEqual([
      expect.objectContaining({
        runnable: false,
        commands: ["draft Jadarian Price"],
      }),
    ]);
  });
});
