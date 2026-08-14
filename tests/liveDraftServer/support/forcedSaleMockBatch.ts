import type { CreateLiveDraftServerOptions } from "../../../src/liveDraftServer.js";
import { summarizeMockBatch, type MockBatch } from "../../../src/modeling/mockBatch.js";
import { mockBatchRunner, testPlayer } from "./mockBatch.js";

const forcedSalePositionFor = (name: string): "QB" | "RB" | "WR" | "TE" | "K" | "DST" => {
  if (name.includes("Puka") || name.includes("Chase")) return "WR";
  if (name.includes("Allen")) return "QB";
  if (name.includes("LaPorta") || name.includes("Bowers")) return "TE";
  return "RB";
};

export const mockBatchRunnerHonoringForcedSales: NonNullable<
  CreateLiveDraftServerOptions["mockBatchRunner"]
> = options => {
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
