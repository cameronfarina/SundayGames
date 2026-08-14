import { expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { interactiveMockDraft } from "./support/interactiveMockDraft.js";
import { mockBatchRunner } from "./support/mockBatch.js";
import { createLiveDraftServer, listen, post, servers, tempSessionDirectory } from "./support/serverHarness.js";

export const registerAdviceTests = (): void => {
  it("serves read-only My Expert advice from the active Mockd roster API", async () => {
    const directory = await tempSessionDirectory();
    try {
      const app = await createLiveDraftServer({
        sessionDirectory: directory,
        interactiveMockDraft,
        mockBatchRunner,
      });
      servers.push(app.server);
      const baseUrl = await listen(app.server);

      const camLineupCommands = [
        "Owner11 drafted Josh Allen for 1",
        "Owner11 drafted Jahmyr Gibbs for 1",
        "Owner11 drafted Ja'Marr Chase for 1",
        "Owner11 drafted Amon-Ra St. Brown for 1",
        "Owner11 drafted Sam LaPorta for 1",
        "Owner11 drafted Jake Bates for 1",
        "Owner11 drafted Steelers D/ST for 1",
        "Owner11 drafted Kenneth Walker III for 1",
        "Owner11 drafted Mike Evans for 1",
        "Owner11 drafted Zay Flowers for 1",
        "Owner11 drafted DeVonta Smith for 1",
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
        owner: "Owner11",
        rosteredCount: expect.any(Number),
        rosteredValue: expect.any(Number),
      }));
      expect(data.team.players.map((player: { name: string }) => player.name)).toEqual(
        expect.arrayContaining(["Ashton Jeanty", "Jahmyr Gibbs"]),
      );

      const hoodyResponse = await fetch(
        `${baseUrl}/api/my-expert?strategy=three-rb&mode=interactive-mock&draftSession=practice-3rb&week=5&owner=Owner02`,
      );
      expect(hoodyResponse.status).toBe(200);
      const hoodyData = await hoodyResponse.json();
      expect(hoodyData.team).toEqual(expect.objectContaining({
        owner: "Owner02",
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

};
