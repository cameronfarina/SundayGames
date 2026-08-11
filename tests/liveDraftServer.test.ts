import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ownerOrder } from "../config/league.js";
import {
  createLiveDraftServer,
  type CreateLiveDraftServerOptions,
} from "../src/liveDraftServer.js";
import {
  summarizeMockBatch,
  type MockBatch,
  type RunMockBatchOptions,
} from "../src/modeling/mockBatch.js";

const tempSessionDirectory = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "mockd-live-draft-server-"));

type TestServer = Awaited<ReturnType<typeof createLiveDraftServer>>["server"];

const mockSaleCommand = "Beaton drafted Jahmyr Gibbs for 74";
const realSaleCommand = "Jakub drafted Christian McCaffrey for 80";
const mockAiSaleCommands = [
  mockSaleCommand,
  "Mello drafted Puka Nacua for 74",
] as const;

const interactiveMockDraft: NonNullable<CreateLiveDraftServerOptions["interactiveMockDraft"]> = {
  buildInteractiveMockDraftState: options => {
    const openingBid = options.nominatedPrice ?? 37;
    return {
      watchOwner: options.watchOwner,
      phase: options.nominatedPlayer
        ? "human-decision"
        : options.commands.length >= 3
          ? "complete"
          : options.commands.length >= 2
            ? "human-decision"
            : "ai-sale",
      pickNumber: options.commands.length + 1,
      aiSaleCommand: mockAiSaleCommands[options.commands.length] ?? mockAiSaleCommands[1],
      nomination: options.nominatedPlayer ? { player: options.nominatedPlayer } : { player: "Breece Hall" },
      auction: {
        status: "cam-decision",
        player: options.nominatedPlayer ?? "Breece Hall",
        currentBid: options.commands.length >= 2 ? 41 : 40,
        currentBidOwner: "Chip",
        nextCamBid: options.commands.length >= 2 ? 42 : 41,
        openingBid,
        feed: [
          { type: "nomination", text: `Cam nominated ${options.nominatedPlayer ?? "Breece Hall"} for $${openingBid}` },
          {
            type: "bid",
            owner: "Chip",
            amount: options.commands.length >= 2 ? 41 : 40,
            text: `Chip bid $${options.commands.length >= 2 ? 41 : 40}`,
          },
        ],
      },
      camDecision: options.nominatedPlayer || options.commands.length >= 2
        ? { recommendedBid: 42, maxBid: 44, topAiBid: 41, topAiBidOwner: "Chip" }
        : undefined,
      topTargets: [{ name: "Breece Hall" }],
      commandCount: options.commands.length,
      nominatedPlayer: options.nominatedPlayer,
      seed: options.seed,
      strategyKey: options.strategyKey,
    };
  },
  resolveInteractiveMockDraftAction: (mockDraft, action) => {
    const draft = mockDraft as {
      aiSaleCommand?: string;
      nominatedPlayer?: string;
      nomination?: { player?: string };
      auction?: { currentBid?: number; feed?: unknown[] };
    };
    if (action === "cam-bid") {
      const nominatedPlayer = draft.nominatedPlayer ?? draft.nomination?.player ?? "Breece Hall";
      if (draft.auction?.currentBid === 41) {
        return {
          mockDraft: {
            ...draft,
            phase: "human-decision",
            auction: {
              ...draft.auction,
              currentBid: 43,
              currentBidOwner: "Chip",
              nextCamBid: 44,
              feed: [
                ...(draft.auction.feed ?? []),
                { type: "bid", owner: "Cam", amount: 42, text: "Cam bid $42" },
                { type: "bid", owner: "Chip", amount: 43, text: "Chip bid $43" },
              ],
            },
            camDecision: { recommendedBid: 44, maxBid: 44, topAiBid: 44, topAiBidOwner: "Chip" },
          },
        };
      }
      return { command: `Cam drafted ${nominatedPlayer} for 42` };
    }
    if (action !== "advance" && action !== "pass") throw new Error(`Unexpected test action: ${action}`);

    return { command: draft.aiSaleCommand ?? mockSaleCommand };
  },
};

const testPlayer = (
  name: string,
  position: "QB" | "RB" | "WR" | "TE" | "K" | "DST",
  price: number,
  week1: number,
) => ({
  name,
  position,
  price,
  week1,
  weeks1To4: week1 * 4,
});

const testRosterPlayers = (owner: string) => [
  testPlayer(`${owner} QB`, "QB", 2, 18),
  testPlayer(`${owner} RB starter low`, "RB", 45, 6),
  testPlayer(`${owner} RB starter high`, "RB", 60, 22),
  testPlayer(`${owner} RB flex`, "RB", 25, 14),
  testPlayer(`${owner} RB bench`, "RB", 4, 4),
  testPlayer(`${owner} WR starter high`, "WR", 28, 20),
  testPlayer(`${owner} WR starter low`, "WR", 14, 15),
  testPlayer(`${owner} WR bench`, "WR", 3, 5),
  testPlayer(`${owner} TE`, "TE", 8, 10),
  testPlayer(`${owner} TE bench`, "TE", 1, 2),
  testPlayer(`${owner} K`, "K", 1, 8),
  testPlayer(`${owner} DST`, "DST", 1, 7),
  testPlayer(`${owner} Bench WR 1`, "WR", 1, 3),
  testPlayer(`${owner} Bench WR 2`, "WR", 1, 2),
  testPlayer(`${owner} Bench RB 1`, "RB", 1, 1),
  testPlayer(`${owner} Bench RB 2`, "RB", 1, 0.5),
];

const mockBatchRunner: NonNullable<CreateLiveDraftServerOptions["mockBatchRunner"]> = options => {
  const runCount = options.runsPerScenario ?? 1;
  const runs: MockBatch["runs"] = Array.from({ length: runCount }, (_, index) => {
    const rosters = ownerOrder.map((owner, ownerIndex) => {
      const players = testRosterPlayers(owner);
      const spend = players.reduce((total, player) => total + player.price, 0);
      const week1Score = 104 + ownerIndex + index;
      return {
        owner,
        spend,
        budgetRemaining: 200 - spend,
        week1Score,
        weeks1To4Score: week1Score * 4,
        valid: true,
        errors: [],
        players,
        positionSpend: { QB: 2, RB: 136, WR: 47, TE: 9, K: 1, DST: 1 },
      };
    });

    return {
      seed: `test-seed-${index + 1}`,
      keeperScenario: {
        key: "expected",
        label: "Expected",
        includedKeeperStatuses: ["confirmed", "assumed"],
        keeperCounts: { QB: 1, RB: 6, WR: 6, TE: 1, K: 0, DST: 0 },
        totalKeeperCost: 100,
        openAuctionDollars: 2700,
        globalFactor: 1.04,
        positionFactors: { QB: 1, RB: 1.04, WR: 1.03, TE: 1.02, K: 1, DST: 1 },
      },
      inputCounts: {
        pricedPlayers: 500,
        auctionPlayers: 220,
        lockedKeepers: 6,
      },
      pickCount: 218,
      picks: [],
      budgetTrajectory: [],
      rosters,
      invalidRosterCount: 0,
      unsoldPlayerCount: 0,
    };
  });

  return {
    options: {
      scenarioKeys: [...(options.scenarioKeys ?? ["expected"])],
      runsPerScenario: runCount,
      seedPrefix: options.seedPrefix ?? "test",
      ...(options.diagnosticsMode === undefined ? {} : { diagnosticsMode: options.diagnosticsMode }),
    },
    runs,
    summary: {
      runCount,
      scenarios: [{
        key: "expected",
        label: "Expected",
        runCount,
        invalidRosterCount: 0,
        averagePickCount: 218,
      }],
      players: [{
        name: "Jahmyr Gibbs",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 72,
        averageSalePrice: 77,
        minimumSalePrice: 76,
        maximumSalePrice: 78,
      }, {
        name: "Cam RB starter high",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 58,
        averageSalePrice: 60,
        minimumSalePrice: 60,
        maximumSalePrice: 60,
      }, {
        name: "Cam RB flex",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averageMarketPrice: 23,
        averageSalePrice: 25,
        minimumSalePrice: 25,
        maximumSalePrice: 25,
      }],
      owners: [{
        owner: "Cam",
        runCount,
        invalidRosterCount: 0,
        averageSpend: 199,
        minimumSpend: 198,
        maximumSpend: 200,
        averageWeek1Score: 104,
        averageWeeks1To4Score: 410,
        averageBudgetRemaining: 1,
        averagePositionSpend: { QB: 2, RB: 150, WR: 40, TE: 5, K: 1, DST: 1 },
      }],
      ownerPlayerExposure: [{
        owner: "Cam",
        player: "Jahmyr Gibbs",
        position: "RB",
        draftedCount: runCount,
        draftedRate: 1,
        averagePrice: 77,
      }],
    },
  };
};

const forcedSalePositionFor = (name: string): "QB" | "RB" | "WR" | "TE" | "K" | "DST" => {
  if (name.includes("Puka") || name.includes("Chase")) return "WR";
  if (name.includes("Allen")) return "QB";
  if (name.includes("LaPorta") || name.includes("Bowers")) return "TE";
  return "RB";
};

const mockBatchRunnerHonoringForcedSales: NonNullable<CreateLiveDraftServerOptions["mockBatchRunner"]> = options => {
  const batch = mockBatchRunner(options);
  const forcedSales = options.forcedSales ?? [];
  if (!forcedSales.length) return batch;

  const runs: MockBatch["runs"] = batch.runs.map(run => {
    const rosters = run.rosters.map(roster => {
      const forcedPlayers = forcedSales
        .filter(sale => sale.owner === roster.owner)
        .map(sale => testPlayer(sale.player, forcedSalePositionFor(sale.player), sale.price, 19));
      const forcedNames = new Set(forcedPlayers.map(player => player.name));
      const players = [
        ...forcedPlayers,
        ...roster.players.filter(player => !forcedNames.has(player.name)),
      ].slice(0, 16);
      const spend = players.reduce((total, player) => total + player.price, 0);
      const positionSpend = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
      for (const player of players) positionSpend[player.position] += player.price;

      return {
        ...roster,
        spend,
        budgetRemaining: 200 - spend,
        players,
        positionSpend,
      };
    });

    return {
      ...run,
      rosters,
    };
  });

  return {
    ...batch,
    runs,
    summary: summarizeMockBatch(runs),
  };
};

const listen = async (server: TestServer): Promise<string> =>
  new Promise(resolve => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected TCP test server address.");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

const post = async (baseUrl: string, path: string, body: Record<string, unknown> = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json(),
  };
};

const waitForMockBatchJob = async (
  baseUrl: string,
  jobId: string,
  owner = "Cam",
  draftSession = "live",
) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const params = new URLSearchParams({ owner, draftSession });
    const job = await fetch(`${baseUrl}/api/mock-batch/${jobId}?${params}`).then(response => response.json());
    if (job.status === "complete" || job.status === "failed") return job;
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  throw new Error(`Mock batch job ${jobId} did not complete in test.`);
};

const syncEnvKeys = [
  "MOCKD_YAHOO_CLIENT_ID",
  "MOCKD_YAHOO_CLIENT_SECRET",
  "MOCKD_YAHOO_REDIRECT_URI",
  "MOCKD_ESPN_LEAGUE_ID",
  "MOCKD_ESPN_SWID",
  "MOCKD_ESPN_S2",
] as const;

const snapshotSyncEnv = (): Partial<Record<(typeof syncEnvKeys)[number], string>> =>
  Object.fromEntries(syncEnvKeys.flatMap(key => {
    const value = process.env[key];
    return value === undefined ? [] : [[key, value]];
  }));

const restoreSyncEnv = (snapshot: Partial<Record<(typeof syncEnvKeys)[number], string>>): void => {
  for (const key of syncEnvKeys) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

describe("live draft server", () => {
  const servers: TestServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
    servers.length = 0;
  });

  it("serves the mature draft workspace at the draft-room browser route", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(`${baseUrl}/draft-room`);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(await response.text()).toContain("id=\"draft-room-view\"");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves an injected workspace document without changing draft APIs", async () => {
    const directory = await tempSessionDirectory();
    try {
      const workspaceHtml = '<!doctype html><main id="unified-draft-workspace"></main>';
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
        workspaceHtml,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(`${baseUrl}/draft-room`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(workspaceHtml);
      expect((await fetch(`${baseUrl}/api/state`)).status).toBe(200);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves the draft board with the same default sourced evidence as prep commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const state = await fetch(`${baseUrl}/api/state?strategy=three-rb`).then(response => response.json());
      const gibbs = state.availableTargets.find((target: { name: string }) => target.name === "Jahmyr Gibbs");
      const london = state.availableTargets.find((target: { name: string }) => target.name === "Drake London");

      expect(gibbs).toMatchObject({
        expectedPrice: 72,
        personalValue: 80,
        recommendedMaxBid: 76,
        draftRoomRank: {
          sourceLabel: "Average Half PPR",
          platformRank: 1.3,
          landmineScore: 5.5,
        },
      });
      expect(london).toMatchObject({
        expectedPrice: 46,
        personalValue: expect.any(Number),
        recommendedMaxBid: 26,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves strategy-aware state and advances interactive mock actions through persisted commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const strategyState = await fetch(`${baseUrl}/api/state?strategy=wr-heavy`).then(response => response.json());
      expect(strategyState.strategy.key).toBe("wr-heavy");
      expect(strategyState.draftMode).toBe("real");

      const mockState = await fetch(`${baseUrl}/api/mock/state?draftSession=practice-3rb&strategy=three-rb&seed=server-test`)
        .then(response => response.json());
      expect(mockState.draftMode).toBe("interactive-mock");
      expect(mockState.strategy.key).toBe("three-rb");
      expect(mockState.mockDraft.strategyKey).toBe("three-rb");
      expect(mockState.mockDraft.seed).toBe("server-test");
      expect(mockState.mockDraft.aiSaleCommand).toContain("drafted");

      const advanced = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-test",
        action: "advance",
      });
      expect(advanced.status).toBe(200);
      expect(advanced.data.events).toHaveLength(1);
      expect(advanced.data.session.commandCount).toBe(1);
      expect(advanced.data.session.paths.directory).toBe(join(directory, "practice-3rb", "interactive-mock"));
      expect(advanced.data.mockDraft.commandCount).toBe(1);

      const undone = await post(baseUrl, "/api/undo", {
        draftSession: "practice-3rb",
        mode: "interactive-mock",
        strategyKey: "wr-heavy",
      });
      expect(undone.status).toBe(200);
      expect(undone.data.strategy.key).toBe("wr-heavy");
      expect(undone.data.draftMode).toBe("interactive-mock");
      expect(undone.data.session.commandCount).toBe(0);

      const sale = await post(baseUrl, "/api/events", {
        strategyKey: "wr-heavy",
        command: mockSaleCommand,
      });
      expect(sale.status).toBe(200);
      expect(sale.data.strategy.key).toBe("wr-heavy");
      expect(sale.data.session.commandCount).toBe(1);

      const reset = await post(baseUrl, "/api/reset", {
        strategyKey: "balanced",
        confirmReset: true,
        expectedCommandCount: 1,
      });
      expect(reset.status).toBe(200);
      expect(reset.data.strategy.key).toBe("balanced");
      expect(reset.data.session.commandCount).toBe(0);

      const imported = await post(baseUrl, "/api/import", {
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 0,
        commands: [mockSaleCommand],
      });
      expect(imported.status).toBe(200);
      expect(imported.data.strategy.key).toBe("three-rb");
      expect(imported.data.session.commandCount).toBe(1);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("applies a real AI mock sale before returning the next nomination", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);
      const openingCommand = "Cam drafted Jahmyr Gibbs for 80";

      const setup = await post(baseUrl, "/api/events", {
        mode: "interactive-mock",
        draftSession: "scratch:real-ai-sale",
        strategyKey: "three-rb",
        command: openingCommand,
      });
      expect(setup.status).toBe(200);

      const preview = await fetch(`${baseUrl}/api/mock/state?draftSession=scratch:real-ai-sale&strategy=three-rb&seed=y`)
        .then(response => response.json());
      const soldPlayer = preview.mockDraft.auction.player;
      const winner = preview.mockDraft.auction.resolution.owner;
      const saleCommand = preview.mockDraft.aiSaleCommand;

      expect(preview.session.commandCount).toBe(1);
      expect(preview.mockDraft.phase).toBe("ai-sale");
      expect(preview.mockDraft.auction.feed.map((event: { type: string }) => event.type)).not.toContain("sold");

      const advanced = await post(baseUrl, "/api/mock/advance", {
        draftSession: "scratch:real-ai-sale",
        strategyKey: "three-rb",
        seed: "y",
        action: "pass",
      });

      expect(advanced.status).toBe(200);
      expect(advanced.data.session.commandCount).toBe(2);
      expect(advanced.data.events.map((event: { input: string }) => event.input)).toEqual([openingCommand, saleCommand]);
      expect(advanced.data.availableTargets.map((target: { name: string }) => target.name)).not.toContain(soldPlayer);
      expect(
        advanced.data.owners
          .find((owner: { owner: string }) => owner.owner === winner)
          .roster
          .map((player: { name: string }) => player.name),
      ).toContain(soldPlayer);
      expect(advanced.data.mockDraft.nomination?.player).not.toBe(soldPlayer);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("keeps real draft actions, interactive practice actions, and bulk mocks in distinct modes", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const realSale = await post(baseUrl, "/api/events", {
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(realSale.status).toBe(200);
      expect(realSale.data.draftMode).toBe("real");
      expect(realSale.data.session.commandCount).toBe(1);
      expect(realSale.data.session.paths.directory).toBe(directory);
      expect(realSale.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const practiceBefore = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(practiceBefore.draftMode).toBe("interactive-mock");
      expect(practiceBefore.session.commandCount).toBe(0);
      expect(practiceBefore.events).toHaveLength(0);

      const practiceSale = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "separate-mode-test",
        action: "advance",
      });
      expect(practiceSale.status).toBe(200);
      expect(practiceSale.data.draftMode).toBe("interactive-mock");
      expect(practiceSale.data.session.commandCount).toBe(1);
      expect(practiceSale.data.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);

      const realAfterPractice = await fetch(`${baseUrl}/api/state?mode=real&strategy=three-rb`)
        .then(response => response.json());
      expect(realAfterPractice.draftMode).toBe("real");
      expect(realAfterPractice.session.commandCount).toBe(1);
      expect(realAfterPractice.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const batch = await post(baseUrl, "/api/mock-batch", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        runs: 3,
        seedPrefix: "server-batch",
      });
      expect(batch.status).toBe(202);
      expect(batch.data.status).toMatch(/queued|running|complete/);
      expect(batch.data.totalRuns).toBe(3);

      const completedBatch = await waitForMockBatchJob(baseUrl, batch.data.jobId, "Cam", "practice-3rb");
      expect(completedBatch.status).toBe("complete");
      expect(completedBatch.percent).toBe(100);
      expect(completedBatch.result.mode).toBe("batch-mock");
      expect(completedBatch.result.summary.runCount).toBe(3);
      expect(completedBatch.result.cam.owner).toBe("Cam");
      expect(completedBatch.result.camTopExposures).toEqual([
        expect.objectContaining({ player: "Jahmyr Gibbs", draftedRate: 1 }),
      ]);

      const realAfterBatch = await fetch(`${baseUrl}/api/state?mode=real&strategy=three-rb`)
        .then(response => response.json());
      const practiceAfterBatch = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(realAfterBatch.session.commandCount).toBe(1);
      expect(practiceAfterBatch.session.commandCount).toBe(1);
      expect(practiceAfterBatch.postDraftAudit[0]).toMatchObject({
        player: "Jahmyr Gibbs",
        mockRange: {
          averageSalePrice: 77,
          minimumSalePrice: 76,
          maximumSalePrice: 78,
          draftedRate: 1,
        },
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("scopes post-draft mock ranges to the matching batch strategy", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const wrongStrategyBatch = await post(baseUrl, "/api/mock-batch", {
        draftSession: "practice-3rb",
        strategyKey: "wr-heavy",
        runs: 1,
        seedPrefix: "wrong-audit-range",
      });
      await waitForMockBatchJob(baseUrl, wrongStrategyBatch.data.jobId, "Cam", "practice-3rb");

      const sale = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "audit-scope-sale",
        action: "advance",
      });
      expect(sale.status).toBe(200);
      expect(sale.data.postDraftAudit[0]).toMatchObject({ player: "Jahmyr Gibbs" });
      expect(sale.data.postDraftAudit[0].mockRange).toBeUndefined();

      const matchingStrategyBatch = await post(baseUrl, "/api/mock-batch", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        runs: 1,
        seedPrefix: "matching-audit-range",
      });
      await waitForMockBatchJob(baseUrl, matchingStrategyBatch.data.jobId, "Cam", "practice-3rb");

      const scopedState = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(scopedState.postDraftAudit[0].mockRange).toMatchObject({
        averageSalePrice: 77,
        minimumSalePrice: 76,
        maximumSalePrice: 78,
        draftedRate: 1,
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("protects the live room from unconfirmed or stale undo, reset, and import actions", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const sale = await post(baseUrl, "/api/events", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(sale.status).toBe(200);
      expect(sale.data.session.commandCount).toBe(1);

      const unconfirmedReset = await post(baseUrl, "/api/reset", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
      });
      expect(unconfirmedReset.status).toBe(409);
      expect(unconfirmedReset.data.session.commandCount).toBe(1);
      expect(unconfirmedReset.data.errors[0]?.message).toContain("requires confirmation");

      const staleReset = await post(baseUrl, "/api/reset", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmReset: true,
        expectedCommandCount: 0,
      });
      expect(staleReset.status).toBe(409);
      expect(staleReset.data.session.commandCount).toBe(1);
      expect(staleReset.data.errors[0]?.message).toContain("currently has 1");

      const unconfirmedUndo = await post(baseUrl, "/api/undo", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
      });
      expect(unconfirmedUndo.status).toBe(409);
      expect(unconfirmedUndo.data.session.commandCount).toBe(1);
      expect(unconfirmedUndo.data.errors[0]?.message).toContain("requires confirmation");

      const staleUndo = await post(baseUrl, "/api/undo", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmUndo: true,
        expectedCommandCount: 0,
      });
      expect(staleUndo.status).toBe(409);
      expect(staleUndo.data.session.commandCount).toBe(1);
      expect(staleUndo.data.errors[0]?.message).toContain("currently has 1");

      const unconfirmedImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        expectedCommandCount: 1,
        commands: [mockSaleCommand],
      });
      expect(unconfirmedImport.status).toBe(409);
      expect(unconfirmedImport.data.session.commandCount).toBe(1);
      expect(unconfirmedImport.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const staleImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 0,
        commands: [mockSaleCommand],
      });
      expect(staleImport.status).toBe(409);
      expect(staleImport.data.session.commandCount).toBe(1);
      expect(staleImport.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);

      const confirmedImport = await post(baseUrl, "/api/import", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmImport: true,
        expectedCommandCount: 1,
        commands: [mockSaleCommand],
      });
      expect(confirmedImport.status).toBe(200);
      expect(confirmedImport.data.session.commandCount).toBe(1);
      expect(confirmedImport.data.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);

      const confirmedUndo = await post(baseUrl, "/api/undo", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        confirmUndo: true,
        expectedCommandCount: 1,
      });
      expect(confirmedUndo.status).toBe(200);
      expect(confirmedUndo.data.session.commandCount).toBe(0);
      expect(confirmedUndo.data.events).toEqual([]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serializes live sale validation so duplicate concurrent purchases cannot both write", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const [firstSale, duplicateSale] = await Promise.all([
        post(baseUrl, "/api/events", {
          draftSession: "live",
          mode: "real",
          strategyKey: "three-rb",
          command: realSaleCommand,
        }),
        post(baseUrl, "/api/events", {
          draftSession: "live",
          mode: "real",
          strategyKey: "three-rb",
          command: realSaleCommand,
        }),
      ]);
      const statuses = [firstSale.status, duplicateSale.status].sort((left, right) => left - right);
      const state = await fetch(`${baseUrl}/api/state?draftSession=live&mode=real&strategy=three-rb`)
        .then(response => response.json());

      expect(statuses).toEqual([200, 422]);
      expect(state.session.commandCount).toBe(1);
      expect(state.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(state.errors).toHaveLength(0);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("keeps named live, practice, and scratch sessions in separate file stores", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const liveSale = await post(baseUrl, "/api/events", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      const practiceSale = await post(baseUrl, "/api/events", {
        draftSession: "practice-3rb",
        mode: "real",
        strategyKey: "three-rb",
        command: mockSaleCommand,
      });
      const scratchSale = await post(baseUrl, "/api/events", {
        draftSession: "scratch:late-room",
        mode: "real",
        strategyKey: "three-rb",
        command: "Seth drafted Derrick Henry for 62",
      });

      expect(liveSale.status).toBe(200);
      expect(practiceSale.status).toBe(200);
      expect(scratchSale.status).toBe(200);

      const liveState = await fetch(`${baseUrl}/api/state?draftSession=live&mode=real`)
        .then(response => response.json());
      const practiceState = await fetch(`${baseUrl}/api/state?draftSession=practice-3rb&mode=real`)
        .then(response => response.json());
      const emptyPracticeState = await fetch(`${baseUrl}/api/state?draftSession=practice-wr-heavy&mode=real`)
        .then(response => response.json());
      const scratchState = await fetch(`${baseUrl}/api/state?draftSession=scratch:late-room&mode=real`)
        .then(response => response.json());

      expect(liveState.activeDraftSession).toMatchObject({ key: "live", label: "Live" });
      expect(liveState.draftSessions.map((session: { key: string }) => session.key)).toEqual(
        expect.arrayContaining(["live", "practice-3rb", "practice-wr-heavy"]),
      );
      expect(liveState.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(liveState.session.paths.directory).toBe(directory);

      expect(practiceState.activeDraftSession).toMatchObject({ key: "practice-3rb", label: "Practice 3RB" });
      expect(practiceState.events.map((event: { input: string }) => event.input)).toEqual([mockSaleCommand]);
      expect(practiceState.session.paths.directory).toBe(join(directory, "practice-3rb"));

      expect(emptyPracticeState.events).toHaveLength(0);
      expect(emptyPracticeState.session.paths.directory).toBe(join(directory, "practice-wr-heavy"));

      expect(scratchState.activeDraftSession).toMatchObject({ key: "scratch:late-room", label: "Scratch: late-room" });
      expect(scratchState.events.map((event: { input: string }) => event.input)).toEqual([
        "Seth drafted Derrick Henry for 62",
      ]);
      expect(scratchState.session.paths.directory).toBe(join(directory, "scratch", "late-room"));

      const practiceMock = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "named-session-test",
        action: "advance",
      });
      expect(practiceMock.status).toBe(200);
      expect(practiceMock.data.session.paths.directory).toBe(join(directory, "practice-3rb", "interactive-mock"));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns an empty latest mock batch response before a batch has run", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(`${baseUrl}/api/mock-batch/latest`);
      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("locks live draft-night sessions against interactive mock advances", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const realSale = await post(baseUrl, "/api/events", {
        draftSession: "live",
        mode: "real",
        strategyKey: "three-rb",
        command: realSaleCommand,
      });
      expect(realSale.status).toBe(200);

      const lockedAdvance = await post(baseUrl, "/api/mock/advance", {
        draftSession: "live",
        strategyKey: "three-rb",
        seed: "locked-live-session",
        action: "advance",
      });
      expect(lockedAdvance.status).toBe(423);
      expect(lockedAdvance.data.draftMode).toBe("real");
      expect(lockedAdvance.data.draftNightLock).toMatchObject({ locked: true });
      expect(lockedAdvance.data.session.commandCount).toBe(1);
      expect(lockedAdvance.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
      expect(lockedAdvance.data.errors[0]?.message).toContain("Live session is locked for mock draft advances");

      const liveState = await fetch(`${baseUrl}/api/state?draftSession=live&mode=interactive-mock&strategy=three-rb`)
        .then(response => response.json());
      expect(liveState.draftMode).toBe("real");
      expect(liveState.draftNightLock).toMatchObject({ locked: true });
      expect(liveState.session.commandCount).toBe(1);
      expect(liveState.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("exports a complete one-click draft session bundle", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const sale = await post(baseUrl, "/api/events", {
        draftSession: "practice-wr-heavy",
        mode: "real",
        strategyKey: "wr-heavy",
        command: realSaleCommand,
      });
      expect(sale.status).toBe(200);

      const response = await fetch(`${baseUrl}/api/export-bundle?draftSession=practice-wr-heavy&mode=real&strategy=wr-heavy`);
      expect(response.status).toBe(200);
      const bundle = await response.json();
      expect(bundle.version).toBe(1);
      expect(bundle.activeDraftSession).toMatchObject({ key: "practice-wr-heavy", label: "Practice WR Heavy" });
      expect(bundle.draftMode).toBe("real");
      expect(bundle.session.commandCount).toBe(1);
      expect(bundle.readiness.status).toMatch(/pass|warn/);
      expect(bundle.currentSnapshot.commands).toEqual([realSaleCommand]);
      expect(bundle.backupSnapshot.commands).toEqual([realSaleCommand]);
      expect(bundle.commandsJson).toContain(realSaleCommand);
      expect(bundle.commandsCsv).toContain("index,command");
      expect(bundle.commandsCsv).toContain(realSaleCommand);
      expect(bundle.auditLogJsonl).toContain(realSaleCommand);

      const reset = await post(baseUrl, "/api/reset", {
        draftSession: "practice-wr-heavy",
        mode: "real",
        strategyKey: "wr-heavy",
      });
      expect(reset.status).toBe(200);
      expect(reset.data.session.commandCount).toBe(0);

      const imported = await post(baseUrl, "/api/import", {
        draftSession: "practice-wr-heavy",
        mode: "real",
        strategyKey: "wr-heavy",
        format: "json",
        content: JSON.stringify(bundle),
      });
      expect(imported.status).toBe(200);
      expect(imported.data.session.commandCount).toBe(1);
      expect(imported.data.events.map((event: { input: string }) => event.input)).toEqual([realSaleCommand]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns a compact import conflict review without replacing the session", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const rejected = await post(baseUrl, "/api/import", {
        draftSession: "practice-3rb",
        mode: "real",
        strategyKey: "three-rb",
        commands: [
          "cam drafted brown for 12",
          "nobody drafted Jahmyr Gibbs for 1",
        ],
      });

      expect(rejected.status).toBe(422);
      expect(rejected.data.session.commandCount).toBe(0);
      expect(rejected.data.events).toHaveLength(0);
      expect(rejected.data.conflictReview).toMatchObject({
        title: "Import needs review",
        importedCount: 2,
        issueCount: 2,
      });
      expect(rejected.data.conflictReview.issues).toEqual([
        expect.objectContaining({
          index: 1,
          type: "ambiguous-player",
          input: "cam drafted brown for 12",
          matchOptions: expect.arrayContaining(["A.J. Brown", "Chase Brown"]),
        }),
        expect.objectContaining({
          index: 2,
          type: "invalid-command",
          input: "nobody drafted Jahmyr Gibbs for 1",
          matchOptions: [],
        }),
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("previews Cam-selected mock nominations before appending the sale command", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const nominationPreview = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-cam-nomination",
        action: "cam-nominate",
        nominatedPlayer: "Breece Hall",
        nominatedPrice: 9,
      });
      expect(nominationPreview.status).toBe(200);
      expect(nominationPreview.data.session.commandCount).toBe(0);
      expect(nominationPreview.data.mockDraft.nominatedPlayer).toBe("Breece Hall");
      expect(nominationPreview.data.mockDraft.auction.openingBid).toBe(9);
      expect(nominationPreview.data.mockDraft.auction.feed[0].text).toBe("Cam nominated Breece Hall for $9");

      const camBid = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-cam-nomination",
        action: "cam-bid",
        nominatedPlayer: "Breece Hall",
      });
      expect(camBid.status).toBe(200);
      expect(camBid.data.session.commandCount).toBe(1);
      expect(camBid.data.events.map((event: { input: string }) => event.input)).toEqual([
        "Cam drafted Breece Hall for 42",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("returns an updated mock auction when AI keeps bidding after Cam raises", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const aiRaise = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-auction-bid",
        action: "cam-bid",
        nominatedPlayer: "Breece Hall",
        mockAuction: {
          currentBid: 41,
          feed: [
            { type: "nomination", text: "Cam nominated Breece Hall for $37" },
            { type: "bid", owner: "Chip", amount: 41, text: "Chip bid $41" },
          ],
        },
      });

      expect(aiRaise.status).toBe(200);
      expect(aiRaise.data.session.commandCount).toBe(0);
      expect(aiRaise.data.events).toHaveLength(0);
      expect(aiRaise.data.mockDraft.auction).toMatchObject({
        currentBid: 43,
        currentBidOwner: "Chip",
        nextCamBid: 44,
      });
      expect(aiRaise.data.mockDraft.auction.feed.map((event: { text: string }) => event.text)).toEqual([
        "Cam nominated Breece Hall for $37",
        "Chip bid $41",
        "Cam bid $42",
        "Chip bid $43",
      ]);

      const camWin = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-3rb",
        strategyKey: "three-rb",
        seed: "server-auction-bid",
        action: "cam-bid",
        mockAuction: aiRaise.data.mockDraft.auction,
      });

      expect(camWin.status).toBe(200);
      expect(camWin.data.session.commandCount).toBe(1);
      expect(camWin.data.events.map((event: { input: string }) => event.input)).toEqual([
        "Cam drafted Breece Hall for 42",
      ]);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("runs interactive mock speed controls through persisted sale commands", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const nextCamDecision = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-wr-heavy",
        strategyKey: "wr-heavy",
        seed: "server-speed-controls",
        action: "next-cam-decision",
      });
      expect(nextCamDecision.status).toBe(200);
      expect(nextCamDecision.data.session.commandCount).toBe(2);
      expect(nextCamDecision.data.events.map((event: { input: string }) => event.input)).toEqual([
        mockAiSaleCommands[0],
        mockAiSaleCommands[1],
      ]);
      expect(nextCamDecision.data.mockDraft.phase).toBe("human-decision");

      const complete = await post(baseUrl, "/api/mock/advance", {
        draftSession: "practice-wr-heavy",
        strategyKey: "wr-heavy",
        seed: "server-speed-controls",
        action: "complete-mock",
      });
      expect(complete.status).toBe(200);
      expect(complete.data.session.commandCount).toBeGreaterThan(2);
      expect(complete.data.mockBatchJob).toMatchObject({
        status: "complete",
        source: "interactive-complete",
        totalRuns: 1,
        percent: 100,
      });
      expect(complete.data.mockBatchJob.result.runs[0].teams).toHaveLength(ownerOrder.length);
      expect(complete.data.mockBatchJob.result.runs[0].rankings).toHaveLength(ownerOrder.length);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }, 20_000);

  it("publishes interactive mock completion as a viewable one-run results job", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const complete = await post(baseUrl, "/api/mock/advance", {
        draftSession: "scratch:completion-results",
        strategyKey: "three-rb",
        seed: "server-complete-results",
        action: "complete-mock",
      });

      expect(complete.status).toBe(200);
      expect(complete.data.mockBatchJob).toMatchObject({
        status: "complete",
        source: "interactive-complete",
        strategyKey: "three-rb",
        runsPerScenario: 1,
        totalRuns: 1,
        completedRuns: 1,
        percent: 100,
      });
      expect(complete.data.mockBatchJob.result.runs).toHaveLength(1);
      expect(complete.data.mockBatchJob.result.runs[0].teams).toHaveLength(ownerOrder.length);
      expect(complete.data.mockBatchJob.result.runs[0].rankings).toHaveLength(ownerOrder.length);
      expect(complete.data.mockBatchJob.result.runs[0].teams[0]).toEqual(expect.objectContaining({
        week1Score: expect.any(Number),
        projectedRank: expect.any(Number),
        rankExplanation: expect.stringContaining("Projected"),
      }));

      const latest = await fetch(
        `${baseUrl}/api/mock-batch/latest?draftSession=scratch%3Acompletion-results&owner=Cam`,
      ).then(response => response.json());
      expect(latest.jobId).toBe(complete.data.mockBatchJob.jobId);
      expect(latest.result.runs[0].label).toBe("Completed mock draft");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }, 20_000);

  it("uses the request owner for interactive mock state", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const response = await fetch(
        `${baseUrl}/api/mock/state?draftSession=practice-3rb&strategy=three-rb&owner=Hoody`,
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.watchOwner.owner).toBe("Hoody");
      expect(data.mockDraft.watchOwner).toBe("Hoody");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("scopes latest mock results and direct job access by owner and draft session", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const camJob = await post(baseUrl, "/api/mock-batch", {
        owner: "Cam",
        draftSession: "scratch:cam-results",
        strategyKey: "three-rb",
        runs: 1,
        seedPrefix: "cam-scoped-results",
      });
      await waitForMockBatchJob(baseUrl, camJob.data.jobId, "Cam", "scratch:cam-results");

      const hoodyJob = await post(baseUrl, "/api/mock-batch", {
        owner: "Hoody",
        draftSession: "scratch:hoody-results",
        strategyKey: "wr-heavy",
        runs: 1,
        seedPrefix: "hoody-scoped-results",
      });
      await waitForMockBatchJob(baseUrl, hoodyJob.data.jobId, "Hoody", "scratch:hoody-results");

      const camLatestResponse = await fetch(
        `${baseUrl}/api/mock-batch/latest?owner=Cam&draftSession=scratch%3Acam-results`,
      );
      const camLatest = await camLatestResponse.json();
      const wrongOwnerResponse = await fetch(
        `${baseUrl}/api/mock-batch/${encodeURIComponent(camJob.data.jobId)}?owner=Hoody&draftSession=scratch%3Acam-results`,
      );

      expect(camLatestResponse.status).toBe(200);
      expect(camLatest.jobId).toBe(camJob.data.jobId);
      expect(camLatest.watchOwner).toBe("Cam");
      expect(camLatest.draftSessionKey).toBe("scratch:cam-results");
      expect(wrongOwnerResponse.status).toBe(404);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("publishes mock results from the active interactive session instead of the latest batch", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner: mockBatchRunnerHonoringForcedSales,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const staleBatch = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "wr-heavy",
        runs: 1,
        seedPrefix: "stale-results",
      });
      await waitForMockBatchJob(baseUrl, staleBatch.data.jobId);

      const sale = await post(baseUrl, "/api/events", {
        draftSession: "scratch:exact-results",
        mode: "interactive-mock",
        strategyKey: "three-rb",
        command: "Cam drafted Breece Hall for 42",
      });
      expect(sale.status).toBe(200);

      const published = await post(baseUrl, "/api/mock/session-results", {
        draftSession: "scratch:exact-results",
        strategyKey: "three-rb",
        seed: "session-results",
        expectedCommandCount: 1,
      });

      expect(published.status).toBe(200);
      expect(published.data.mockBatchJob).toMatchObject({
        status: "complete",
        source: "interactive-complete",
        draftSessionKey: "scratch:exact-results",
        draftMode: "interactive-mock",
        commandCount: 1,
        strategyKey: "three-rb",
      });
      const camTeam = published.data.mockBatchJob.result.runs[0].teams
        .find((team: { owner: string }) => team.owner === "Cam");
      expect(camTeam.players).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "Breece Hall", price: 42 }),
      ]));

      const latest = await fetch(
        `${baseUrl}/api/mock-batch/latest?draftSession=scratch%3Aexact-results&owner=Cam`,
      ).then(response => response.json());
      expect(latest.jobId).toBe(published.data.mockBatchJob.jobId);
      expect(latest.jobId).not.toBe(staleBatch.data.jobId);
      expect(latest.draftSessionKey).toBe("scratch:exact-results");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves mock results and returns complete optimized 14-team run payloads", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const resultsPage = await fetch(`${baseUrl}/mock-results`);
      expect(resultsPage.status).toBe(200);
      expect(await resultsPage.text()).toContain("id=\"mock-results-view\"");
      const simulationsPage = await fetch(`${baseUrl}/mock-simulations`);
      expect(simulationsPage.status).toBe(200);
      expect(await simulationsPage.text()).toContain("id=\"mock-simulations-view\"");

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 2,
        seedPrefix: "results-test",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);
      expect(completed.result.runs).toHaveLength(2);
      expect(completed.result.runs[0].label).toBe("Run 1: 3rb");
      expect(completed.result.runs[0].teams).toHaveLength(ownerOrder.length);
      expect(completed.result.runs[0].rankings).toHaveLength(ownerOrder.length);
      expect(completed.result.runs[0].bestBuild.owner).toBe("Mello");
      expect(completed.result.runs[0].worstBuild.owner).toBe("Beaton");
      expect(completed.result.runs[0].bestBuild.corePlayers).toHaveLength(3);
      expect(completed.result.runs[0].camOutcome.owner).toBe("Cam");
      expect(completed.result.runs[0].camOutcome.rank).toBeGreaterThan(1);
      expect(completed.result.runs[0].camOutcome.headline).toContain("projected");
      expect(completed.result.runs[0].rankings[0].explanation).toContain("Projected 1st");

      const cam = completed.result.runs[0].teams.find((team: { owner: string }) => team.owner === "Cam");
      expect(cam.players).toHaveLength(16);
      expect(cam.projectedRank).toBe(completed.result.runs[0].camOutcome.rank);
      expect(cam.rankExplanation).toContain("Projected");
      expect(cam.topStarter.name).toBe("Cam RB starter high");
      expect(cam.starters.map((player: { slot: string }) => player.slot)).toEqual([
        "QB",
        "RB1",
        "RB2",
        "WR1",
        "WR2",
        "TE",
        "FLEX",
        "K",
        "DST",
      ]);
      expect(cam.starters.find((player: { slot: string }) => player.slot === "RB1").name).toBe("Cam RB starter high");
      expect(cam.starters.find((player: { slot: string }) => player.slot === "RB2").name).toBe("Cam RB flex");
      expect(cam.starters.find((player: { slot: string }) => player.slot === "FLEX").name).toBe("Cam RB starter low");

      const latest = await fetch(`${baseUrl}/api/mock-batch/latest`).then(response => response.json());
      expect(latest.jobId).toBe(started.data.jobId);
      expect(latest.result.runs[1].label).toBe("Run 2: balanced");
      expect(latest.result.runStrategyKeys).toEqual(["three-rb", "balanced"]);
      expect(latest.result.analytics.strategyLeaderboard).toEqual(expect.arrayContaining([
        expect.objectContaining({
          strategyKey: "three-rb",
          runCount: 1,
        }),
        expect.objectContaining({
          strategyKey: "balanced",
          runCount: 1,
        }),
      ]));
      expect(latest.result.analytics.camScoreRange).toEqual(expect.objectContaining({
        minimumWeek1Score: completed.result.runs[0].camOutcome.week1Score,
        maximumWeek1Score: completed.result.runs[1].camOutcome.week1Score,
        minimumWeeks1To4Score: completed.result.runs[0].camOutcome.weeks1To4Score,
        maximumWeeks1To4Score: completed.result.runs[1].camOutcome.weeks1To4Score,
      }));
      expect(latest.result.analytics.topCamRosterPaths[0]).toEqual(expect.objectContaining({
        count: 2,
        draftedRate: 1,
      }));
      expect(latest.result.analytics.strategyCoach).toEqual(expect.objectContaining({
        headline: expect.stringContaining("sampled"),
        blueprint: expect.arrayContaining([
          expect.objectContaining({
            slot: "RB1",
            targetNames: expect.arrayContaining(["Cam RB starter high"]),
          }),
        ]),
      }));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("accepts scripted mock targets and applies Cam max-bid caps to the batch job", async () => {
    const directory = await tempSessionDirectory();
    let capturedOptions: RunMockBatchOptions | undefined;
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner: options => {
          capturedOptions = options;
          return mockBatchRunner(options);
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 25,
        seedPrefix: "script-test",
        script: "run 2 mocks where i target jadarian price, where im not willing to pay over $20",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);

      expect(capturedOptions?.runsPerScenario).toBe(2);
      expect(started.data.runsPerScenario).toBe(2);
      expect(started.data.runStrategyKeys).toEqual(["three-rb", "balanced"]);
      expect(capturedOptions?.auctionConfigOverrides?.ownerPlayerTargetMaxBids?.Cam?.["Jadarian Price"]).toBe(20);
      expect(completed.result.script).toMatchObject({
        label: "Target Jadarian Price up to $20",
        targetOutcomes: [
          expect.objectContaining({
            owner: "Cam",
            player: "Jadarian Price",
            maxBid: 20,
            runCount: 2,
          }),
        ],
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("rejects ambiguous scripted mock player names before starting a batch job", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 2,
        seedPrefix: "ambiguous-script-test",
        script: "target Williams max 20",
      });

      expect(started.status).toBe(422);
      expect(started.data.error).toContain('Ambiguous mock script player "Williams"');
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("accepts build-around mock scripts and runs each price point as a forced Cam start", async () => {
    const directory = await tempSessionDirectory();
    const capturedOptions: RunMockBatchOptions[] = [];
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner: options => {
          capturedOptions.push(options);
          return mockBatchRunner(options);
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const started = await post(baseUrl, "/api/mock-batch", {
        strategyKey: "three-rb",
        runs: 2,
        seedPrefix: "build-around-server-test",
        script: "build around omarion hampton at 46-50:2; target zay flowers max 31",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);

      expect(started.data.totalRuns).toBe(6);
      expect(started.data.runStrategyKeys).toEqual([
        "three-rb",
        "balanced",
        "three-rb",
        "balanced",
        "three-rb",
        "balanced",
      ]);
      expect(completed.status).toBe("complete");
      expect(completed.result.summary.runCount).toBe(6);
      expect(completed.result.script).toMatchObject({
        label: "Build around Omarion Hampton at $46/$48/$50 / Target Zay Flowers up to $31",
        buildAround: {
          owner: "Cam",
          player: "Omarion Hampton",
          prices: [46, 48, 50],
        },
      });
      expect(completed.result.runs.map((run: { label: string }) => run.label)).toEqual([
        "Run 1: Hampton $46 / 3RB",
        "Run 2: Hampton $46 / Balanced",
        "Run 3: Hampton $48 / 3RB",
        "Run 4: Hampton $48 / Balanced",
        "Run 5: Hampton $50 / 3RB",
        "Run 6: Hampton $50 / Balanced",
      ]);
      expect(capturedOptions.map(options => options.forcedSales)).toEqual([
        [{ owner: "Cam", player: "Omarion Hampton", price: 46 }],
        [{ owner: "Cam", player: "Omarion Hampton", price: 48 }],
        [{ owner: "Cam", player: "Omarion Hampton", price: 50 }],
      ]);
      for (const options of capturedOptions) {
        expect(options.runsPerScenario).toBe(2);
        expect(options.auctionConfigOverrides?.ownerPlayerTargetMaxBids?.Cam?.["Zay Flowers"]).toBe(31);
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves the player news page and local evidence-backed player news API", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
        playerNewsProvider: async () => [{
          provider: "rotowire-rss",
          providerItemId: "rss-trey-benson",
          playerName: "Trey Benson",
          title: "Tending to sore knee",
          summary: "Benson is dealing with discomfort in his left knee.",
          publishedAt: "2026-08-03T22:00:00.000Z",
          fetchedAt: "2026-08-03T22:30:00.000Z",
          tags: ["Injury"],
          raw: {},
        }],
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const page = await fetch(`${baseUrl}/player-news`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("id=\"player-news-view\"");

      const response = await fetch(`${baseUrl}/api/player-news?strategy=three-rb&category=Injury`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.totalCount).toBeGreaterThan(0);
      expect(data.items.length).toBeGreaterThan(0);
      expect(data.items.every((item: { category: string }) => item.category === "Injury")).toBe(true);
      expect(data.items[0]).toEqual(expect.objectContaining({
        player: expect.any(String),
        headline: expect.any(String),
        fantasyImpact: expect.any(String),
        draftAction: expect.stringMatching(/Fade|Move up|Watch|No model change/),
        source: expect.objectContaining({ provider: expect.any(String) }),
      }));
      expect(data.providers).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "local-evidence", status: "active" }),
        expect.objectContaining({ key: "sportsdataio", status: "candidate" }),
      ]));

      const rssResponse = await fetch(`${baseUrl}/api/player-news?source=rotowire-rss&q=Trey%20Benson`);
      expect(rssResponse.status).toBe(200);
      const rssData = await rssResponse.json();
      expect(rssData.items).toEqual(expect.arrayContaining([
        expect.objectContaining({
          player: "Trey Benson",
          position: "RB",
          teamAbbreviation: "ARI",
        }),
      ]));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves read-only My Expert advice from the active Mockd roster", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const page = await fetch(`${baseUrl}/my-expert`);
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("id=\"my-expert-view\"");

      const camLineupCommands = [
        "Cam drafted Josh Allen for 1",
        "Cam drafted Jahmyr Gibbs for 1",
        "Cam drafted Ja'Marr Chase for 1",
        "Cam drafted Amon-Ra St. Brown for 1",
        "Cam drafted Sam LaPorta for 1",
        "Cam drafted Jake Bates for 1",
        "Cam drafted Steelers D/ST for 1",
        "Cam drafted Kenneth Walker III for 1",
        "Cam drafted Mike Evans for 1",
        "Cam drafted Zay Flowers for 1",
        "Cam drafted DeVonta Smith for 1",
      ];
      for (const command of camLineupCommands) {
        const sale = await post(baseUrl, "/api/events", {
          draftSession: "practice-3rb",
          mode: "interactive-mock",
          strategyKey: "three-rb",
          command,
        });
        expect(sale.status, `${command}: ${JSON.stringify(sale.data)}`).toBe(200);
        expect(sale.data.errors).toEqual([]);
      }

      const response = await fetch(
        `${baseUrl}/api/my-expert?strategy=three-rb&mode=interactive-mock&draftSession=practice-3rb&week=5`,
      );
      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.mode).toBe("advice-only");
      expect(data.readOnly).toBe(true);
      expect(data.source).toEqual(expect.objectContaining({
        key: "mockd-draft",
        label: "Mockd draft",
        readOnly: true,
      }));
      expect(data.team).toEqual(expect.objectContaining({
        owner: "Cam",
        rosteredCount: expect.any(Number),
        rosteredValue: expect.any(Number),
      }));
      expect(data.team.players.map((player: { name: string }) => player.name)).toEqual(
        expect.arrayContaining(["De'Von Achane", "Jahmyr Gibbs"]),
      );

      const hoodyResponse = await fetch(
        `${baseUrl}/api/my-expert?strategy=three-rb&mode=interactive-mock&draftSession=practice-3rb&week=5&owner=Hoody`,
      );
      expect(hoodyResponse.status).toBe(200);
      const hoodyData = await hoodyResponse.json();
      expect(hoodyData.team).toEqual(expect.objectContaining({
        owner: "Hoody",
      }));
      expect(data.summary).toEqual(expect.objectContaining({
        currentWeek: 5,
        recommendationCount: expect.any(Number),
      }));
      expect(data.recommendations).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: "lineup",
          priority: expect.stringMatching(/high|medium|low/),
          readOnly: true,
          title: expect.stringContaining("Start"),
          lineup: expect.objectContaining({
            starters: expect.any(Array),
            flexChoice: expect.any(Object),
            flexCandidates: expect.any(Array),
          }),
          reasons: expect.arrayContaining([
            expect.stringMatching(/adjusted|projection|score|matchup|opportunity|trend|risk/i),
          ]),
        }),
        expect.objectContaining({
          type: "bye-coverage",
          priority: "high",
          readOnly: true,
          title: expect.stringContaining("Week 6"),
          suggestedAdds: expect.any(Array),
          suggestedDrops: expect.any(Array),
        }),
      ]));
      expect(data.integrations).toEqual(expect.arrayContaining([
        expect.objectContaining({ key: "espn", status: "setup-required", readOnly: true }),
        expect.objectContaining({ key: "sleeper", status: "available", readOnly: true }),
        expect.objectContaining({ key: "yahoo", status: "setup-required", readOnly: true }),
      ]));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("serves read-only league sync provider readiness and setup-gated Yahoo OAuth", async () => {
    const directory = await tempSessionDirectory();
    let sleeperDirectory: string | undefined;
    const envSnapshot = snapshotSyncEnv();
    try {
      for (const key of syncEnvKeys) delete process.env[key];

      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const providersResponse = await fetch(`${baseUrl}/api/sync/providers`);
      expect(providersResponse.status).toBe(200);
      const providersData = await providersResponse.json();
      expect(providersData.policy).toEqual(expect.objectContaining({
        mode: "read-only",
        blockedActions: expect.arrayContaining(["add", "drop", "trade", "set-lineup"]),
      }));
      expect(providersData.providers).toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: "sleeper",
          status: "available",
          auth: expect.objectContaining({ type: "none", configured: true }),
        }),
        expect.objectContaining({
          key: "yahoo",
          status: "setup-required",
          auth: expect.objectContaining({ type: "oauth2", configured: false }),
        }),
      ]));

      const yahooStartResponse = await fetch(`${baseUrl}/api/sync/oauth/yahoo/start`);
      expect(yahooStartResponse.status).toBe(501);
      const yahooStartData = await yahooStartResponse.json();
      expect(yahooStartData).toEqual(expect.objectContaining({
        provider: "yahoo",
        error: expect.stringMatching(/MOCKD_YAHOO_CLIENT_ID/i),
        requiredEnv: expect.arrayContaining(["MOCKD_YAHOO_CLIENT_ID", "MOCKD_YAHOO_CLIENT_SECRET"]),
      }));
      expect(yahooStartData.setupSteps).toEqual(expect.arrayContaining([expect.stringMatching(/Yahoo Developer/i)]));

      process.env.MOCKD_YAHOO_CLIENT_ID = "test-client-id";
      process.env.MOCKD_YAHOO_CLIENT_SECRET = "test-client-secret";
      const readyYahooStartResponse = await fetch(`${baseUrl}/api/sync/oauth/yahoo/start`);
      expect(readyYahooStartResponse.status).toBe(200);
      const readyYahooStartData = await readyYahooStartResponse.json();
      expect(readyYahooStartData).toEqual(expect.objectContaining({
        provider: "yahoo",
        readOnly: true,
        redirectUri: `${baseUrl}/api/sync/oauth/yahoo/callback`,
        scope: "fspt-r",
        state: expect.any(String),
      }));
      expect(readyYahooStartData.authorizationUrl).toContain("https://api.login.yahoo.com/oauth2/request_auth");
      expect(readyYahooStartData.authorizationUrl).toContain("client_id=test-client-id");
      expect(readyYahooStartData.authorizationUrl).toContain("response_type=code");

      const callbackResponse = await fetch(
        `${baseUrl}/api/sync/oauth/yahoo/callback?code=test-code&state=${readyYahooStartData.state}`,
      );
      expect(callbackResponse.status).toBe(200);
      const callbackData = await callbackResponse.json();
      expect(callbackData).toEqual(expect.objectContaining({
        provider: "yahoo",
        readOnly: true,
        status: "authorization-code-received",
        tokenEndpoint: "https://api.login.yahoo.com/oauth2/get_token",
      }));

      sleeperDirectory = await tempSessionDirectory();
      const sleeperApp = await createLiveDraftServer({
        sessionDirectory: sleeperDirectory,
        interactiveMockDraft,
        mockBatchRunner,
        sleeperSyncPreviewProvider: async ({ identifier, season }) => ({
          provider: "sleeper",
          readOnly: true,
          identifier,
          season,
          resolvedAs: "user",
          message: "Found 1 Sleeper league.",
          leagues: [{
            leagueId: "123",
            name: "Cam Sleeper League",
            status: "in_season",
            season,
            totalRosters: 12,
          }],
        }),
      });
      servers.push(sleeperApp.server);
      const sleeperBaseUrl = await listen(sleeperApp.server);
      const sleeperResponse = await fetch(`${sleeperBaseUrl}/api/sync/sleeper/preview?identifier=cam&season=2026`);
      expect(sleeperResponse.status).toBe(200);
      await expect(sleeperResponse.json()).resolves.toEqual(expect.objectContaining({
        provider: "sleeper",
        readOnly: true,
        identifier: "cam",
        season: "2026",
        message: "Found 1 Sleeper league.",
        leagues: [expect.objectContaining({ leagueId: "123", name: "Cam Sleeper League" })],
      }));
    } finally {
      restoreSyncEnv(envSnapshot);
      await rm(directory, { force: true, recursive: true });
      if (sleeperDirectory) await rm(sleeperDirectory, { force: true, recursive: true });
    }
  });

  it("keeps all-source player news useful when the optional remote provider fails", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
        playerNewsProvider: async () => {
          throw new Error("provider down");
        },
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const defaultSources = await fetch(`${baseUrl}/api/player-news`);
      expect(defaultSources.status).toBe(200);
      const defaultSourcesData = await defaultSources.json();
      expect(defaultSourcesData.sourceMode).toBe("all");
      expect(defaultSourcesData.summary.totalCount).toBeGreaterThan(0);
      expect(defaultSourcesData.items.length).toBeGreaterThan(0);

      const allSources = await fetch(`${baseUrl}/api/player-news?source=all`);
      expect(allSources.status).toBe(200);
      const allSourcesData = await allSources.json();
      expect(allSourcesData.sourceMode).toBe("all");
      expect(allSourcesData.summary.totalCount).toBeGreaterThan(0);
      expect(allSourcesData.items.length).toBeGreaterThan(0);

      const localOnly = await fetch(`${baseUrl}/api/player-news?source=local`);
      expect(localOnly.status).toBe(200);
      const localOnlyData = await localOnly.json();
      expect(localOnlyData.sourceMode).toBe("local");
      expect(localOnlyData.summary.totalCount).toBeGreaterThan(0);

      const remoteOnly = await fetch(`${baseUrl}/api/player-news?source=rotowire-rss`);
      expect(remoteOnly.status).toBe(500);
      await expect(remoteOnly.json()).resolves.toEqual({
        error: "provider down",
      });
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
