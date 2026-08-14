import { leagueConfig } from "../../../config/league.js";
import { buildProjectionRankings } from "../../modeling/projectionRankings.js";
import { defaultSeasonLongProjectionPath, loadCurrentProjections } from "../../projections.js";
import { projectionPath } from "../inputs.js";

export const runRankingsCommand = async (): Promise<void> => {
  const rankings = buildProjectionRankings(await loadCurrentProjections({ projectionPath }));
  console.log(JSON.stringify({
    source: {
      projectionFile: projectionPath,
      seasonLongProjectionFile: defaultSeasonLongProjectionPath,
      projectionLeagueId: 278452,
      historicalLeagueId: leagueConfig.leagueId,
      caveat: "Projection scoring is public; historical pricing uses the configured local data source when present.",
      rankBasis: "Weeks 1-4 projected fantasy points positional rank",
    },
    count: rankings.length,
    rankings,
  }, null, 2));
};
