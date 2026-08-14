import { loadHistoricalAuctionRecords } from "../../data/parseHistoricalBoards.js";
import { loadCurrentProjections } from "../../projections.js";
import { projectionPath } from "../inputs.js";

const countBySeason = (records: { season: number }[]): Record<number, number> =>
  records.reduce<Record<number, number>>((counts, record) => {
    counts[record.season] = (counts[record.season] ?? 0) + 1;
    return counts;
  }, {});

export const runValidateCommand = async (): Promise<void> => {
  const players = await loadCurrentProjections({ projectionPath });
  const historicalRecords = await loadHistoricalAuctionRecords();
  const visibleRecords = historicalRecords.filter(record => record.acquisitionType !== "post-draft waiver");
  console.log(`Loaded ${players.length} projection records.`);
  console.log(`Loaded ${historicalRecords.length} historical roster records.`);
  console.log(`Visible draft records by season: ${JSON.stringify(countBySeason(visibleRecords))}.`);
};
