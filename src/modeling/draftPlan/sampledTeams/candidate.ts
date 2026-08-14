import { lineupScore, optimizeLineup } from "../../../lineupOptimizer.js";
import type { MockRosterSummary } from "../../mockBatch.js";
import type {
  DraftPlanCandidate,
  DraftPlanPlayerMarket,
  DraftPlanStrategyDefinition,
} from "../contracts.js";
import { roundToTwo } from "../numbers.js";
import { draftPlanPlayerFor, sortPlayers } from "../players.js";
import { qualifiesForStrategy } from "./qualification.js";

export const buildCandidate = (
  seed: string,
  scenarioKey: string,
  roster: MockRosterSummary,
  strategy: DraftPlanStrategyDefinition,
  marketByName: ReadonlyMap<string, DraftPlanPlayerMarket>,
): DraftPlanCandidate | undefined => {
  if (!roster.valid) return undefined;
  const rbCore = sortPlayers(roster.players.filter(player => player.position === "RB")).slice(0, 3);
  const optimizedLineup = optimizeLineup(
    { strategy: strategy.key, players: roster.players },
    "weeks1To4",
  );
  if (!qualifiesForStrategy(roster, rbCore, strategy, optimizedLineup)) return undefined;

  const lineupNames = new Set(optimizedLineup.map(entry => entry.player.name));
  const players = sortPlayers(roster.players)
    .map(player => draftPlanPlayerFor(player, marketByName));
  const draftedPlayerByName = new Map(players.map(player => [player.name, player]));
  const lineup = optimizedLineup.map(entry => ({
    slot: entry.slot,
    player: draftedPlayerByName.get(entry.player.name) ??
      draftPlanPlayerFor(entry.player, marketByName),
  }));
  const bench = sortPlayers(roster.players.filter(player => !lineupNames.has(player.name)))
    .map(player => draftedPlayerByName.get(player.name) ?? draftPlanPlayerFor(player, marketByName));

  return {
    seed,
    scenarioKey,
    owner: roster.owner,
    strategy: strategy.key,
    rosterSpend: roster.spend,
    budgetRemaining: roster.budgetRemaining,
    week1Score: roundToTwo(roster.week1Score ?? 0),
    weeks1To4Score: roundToTwo(
      roster.weeks1To4Score ?? lineupScore(optimizedLineup, "weeks1To4"),
    ),
    rbCoreSpend: rbCore.reduce((total, player) => total + player.price, 0),
    positionSpend: roster.positionSpend,
    rbCore: rbCore.map(player => draftPlanPlayerFor(player, marketByName)),
    lineup,
    bench,
    players,
  };
};
