import { addDropCardFor } from "./addDropCard.js";
import { byeCoverageCardFor } from "./byeCoverageCard.js";
import { readOnlyPolicy } from "./constants.js";
import type { BuildMyExpertAdviceOptions, MyExpertAdvice, MyExpertAdviceCard } from "./contracts.js";
import { injuryWatchCardFor } from "./injuryWatchCard.js";
import { lineupAdvisorCardFor } from "./lineupCard.js";
import { matchupScoresFor, matchupSignalsByPlayerFor, newsByPlayerFor } from "./signalIndexes.js";
import { tradeTargetCardFor } from "./tradeTargetCard.js";

const definedCard = (card: MyExpertAdviceCard | undefined): card is MyExpertAdviceCard => card !== undefined;

export const buildMyExpertAdvice = ({
  currentWeek,
  leagueSettings,
  roster,
  availablePlayers,
  matchups,
  news,
  tradeCandidates,
}: BuildMyExpertAdviceOptions): MyExpertAdvice => {
  const matchupScores = matchupScoresFor(currentWeek, matchups);
  const matchupSignalsByPlayer = matchupSignalsByPlayerFor(currentWeek, matchups);
  const newsByPlayer = newsByPlayerFor(news);
  const cards = [
    lineupAdvisorCardFor(currentWeek, leagueSettings, roster, matchupScores, matchupSignalsByPlayer, newsByPlayer),
    addDropCardFor(leagueSettings, roster, availablePlayers, matchupScores),
    byeCoverageCardFor(currentWeek, leagueSettings, roster, availablePlayers, matchupScores),
    injuryWatchCardFor(roster, news),
    tradeTargetCardFor(leagueSettings, roster, tradeCandidates, matchupScores),
  ].filter(definedCard);

  return { currentWeek, policy: readOnlyPolicy, cards };
};
