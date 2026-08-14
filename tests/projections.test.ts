import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEspnWeeksOneToFour } from "../src/projections.js";

const temporaryDirectories: string[] = [];

const projectionFile = async (value: unknown): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "mockd-projections-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "projections.json");
  await writeFile(path, JSON.stringify(value));
  return path;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory =>
    rm(directory, { recursive: true, force: true })
  ));
});

describe("ESPN projection input", () => {
  it("fails closed when the provider payload is not a projection document", async () => {
    await expect(loadEspnWeeksOneToFour(await projectionFile(null))).resolves.toEqual([]);
    await expect(loadEspnWeeksOneToFour(await projectionFile({ weeks: [null] }))).resolves.toEqual([]);
  });

  it("narrows valid player, stat, rank, and auction fields", async () => {
    const path = await projectionFile({
      weeks: [{
        week: 1,
        data: {
          players: [{
            player: {
              id: 7,
              fullName: "Example Runner",
              defaultPositionId: 2,
              proTeamId: 12,
              stats: [
                { seasonId: 2026, scoringPeriodId: 1, statSourceId: 1, statSplitTypeId: 1, appliedTotal: 14.5 },
                { seasonId: 2026, scoringPeriodId: 0, statSourceId: 1, statSplitTypeId: 0, appliedTotal: 245 },
              ],
              draftRanksByRankType: { PPR: { rank: 11, auctionValue: 42 } },
            },
          }],
        },
      }],
    });

    await expect(loadEspnWeeksOneToFour(path)).resolves.toEqual([{
      id: 7,
      name: "Example Runner",
      position: "RB",
      proTeamId: 12,
      weeks: { 1: 14.5 },
      weeks1To4: 14.5,
      seasonProjection: 245,
      espnRank: 11,
      espnAuctionValue: 42,
    }]);
  });
});
