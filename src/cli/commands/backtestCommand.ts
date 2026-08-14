import { loadHistoricalAuctionRecords } from "../../data/parseHistoricalBoards.js";
import { buildHistoricalBacktest } from "../../modeling/historicalBacktest.js";

export const runBacktestCommand = async (): Promise<void> => {
  console.log(JSON.stringify(buildHistoricalBacktest(await loadHistoricalAuctionRecords()), null, 2));
};
