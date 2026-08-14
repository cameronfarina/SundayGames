import type { MockResultsPlayer } from "../mockResults.js";
import { moneyText } from "./math.js";
import type {
  StrategyLabSampleBuild,
  StrategyLabTargetOutcome,
} from "./reportContracts.js";
import type {
  StrategyLabForcedStart,
  StrategyLabTargetMaxBid,
} from "./scenarioContracts.js";

export const forcedStartMarkdown = (forcedStart: StrategyLabForcedStart): string =>
  forcedStart.players
    .map(player => `${player.player} ${moneyText(player.price)} (${player.source})`)
    .join(" | ");

export const targetMaxBidsMarkdown = (
  targetMaxBids: readonly StrategyLabTargetMaxBid[],
): string =>
  targetMaxBids
    .map(target => `${target.player} up to ${moneyText(target.maxBid)}`)
    .join(" | ");

export const targetOutcomesMarkdown = (
  targetOutcomes: readonly StrategyLabTargetOutcome[],
): string =>
  targetOutcomes
    .map(outcome =>
      `${outcome.player}: primary team won ${outcome.draftedByCamCount}/${outcome.runCount} (${Math.round(outcome.draftedByCamRate * 100)}%), avg sale ${moneyText(outcome.averageSalePrice)}, range ${moneyText(outcome.minimumSalePrice)}-${moneyText(outcome.maximumSalePrice)}`,
    )
    .join(" | ");

export const sampleMarkdown = (sample: StrategyLabSampleBuild): string =>
  [
    `Best sample ${sample.label}`,
    `Primary team rank ${sample.camRank}, Week 1 ${sample.camWeek1Score.toFixed(1)}, season strength ${sample.camSeasonStrengthScore.toFixed(1)}, thinness ${sample.thinnessScore.toFixed(1)}`,
    `Core: ${sample.corePlayers.join(" | ")}`,
  ].join(" - ");

const playerMarkdown = (player: MockResultsPlayer): string =>
  `${player.slot} ${player.name} ${moneyText(player.price)} (${player.week1.toFixed(1)} W1)`;

const benchPlayerMarkdown = (player: MockResultsPlayer): string =>
  `${player.position} ${player.name} ${moneyText(player.price)} (${player.week1.toFixed(1)} W1)`;

export const sampleStartersMarkdown = (sample: StrategyLabSampleBuild): string =>
  sample.camPlayers.filter(player => player.starter).map(playerMarkdown).join(" | ");

export const sampleBenchMarkdown = (sample: StrategyLabSampleBuild): string =>
  sample.camPlayers
    .filter(player => !player.starter)
    .slice(0, 7)
    .map(benchPlayerMarkdown)
    .join(" | ");
