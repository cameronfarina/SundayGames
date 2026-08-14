import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { ownerOrder } from "../../config/league.js";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory, waitForMockBatchJob } from "./support/serverHarness.js";

export const registerOptimizedResultTests = (): void => {
  it("returns complete optimized 14-team mock result payloads", async () => {
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
        seedPrefix: "results-test",
      });
      const completed = await waitForMockBatchJob(baseUrl, started.data.jobId);
      expect(completed.result.runs).toHaveLength(2);
      expect(completed.result.runs[0].label).toBe("Run 1: 3rb");
      expect(completed.result.runs[0].teams).toHaveLength(ownerOrder.length);
      expect(completed.result.runs[0].rankings).toHaveLength(ownerOrder.length);
      expect(completed.result.runs[0].bestBuild.owner).toBe("Owner14");
      expect(completed.result.runs[0].worstBuild.owner).toBe("Owner01");
      expect(completed.result.runs[0].bestBuild.corePlayers).toHaveLength(3);
      expect(completed.result.runs[0].camOutcome.owner).toBe("Owner11");
      expect(completed.result.runs[0].camOutcome.rank).toBeGreaterThan(1);
      expect(completed.result.runs[0].camOutcome.headline).toContain("projected");
      expect(completed.result.runs[0].rankings[0].explanation).toContain("Projected 1st");

      const owner11 = completed.result.runs[0].teams.find((team: { owner: string }) => team.owner === "Owner11");
      expect(owner11.players).toHaveLength(16);
      expect(owner11.projectedRank).toBe(completed.result.runs[0].camOutcome.rank);
      expect(owner11.rankExplanation).toContain("Projected");
      expect(owner11.topStarter.name).toBe("Owner11 RB starter high");
      expect(owner11.starters.map((player: { slot: string }) => player.slot)).toEqual([
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
      expect(owner11.starters.find((player: { slot: string }) => player.slot === "RB1").name).toBe("Owner11 RB starter high");
      expect(owner11.starters.find((player: { slot: string }) => player.slot === "RB2").name).toBe("Owner11 RB flex");
      expect(owner11.starters.find((player: { slot: string }) => player.slot === "FLEX").name).toBe("Owner11 RB starter low");

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
            targetNames: expect.arrayContaining(["Owner11 RB starter high"]),
          }),
        ]),
      }));
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

};
