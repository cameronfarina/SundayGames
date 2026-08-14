import type { MyExpertMatchupSignal, MyExpertNewsSignal, MyExpertPlayer } from "./contracts.js";
import { formatOneDecimal, formatSigned, sentenceFrom } from "./formatting.js";

const signalEvidenceFor = (label: string, value: number | undefined): string[] =>
  value === undefined || value === 0 ? [] : [`${label} signal ${formatSigned(value)}.`];

const matchupEvidenceFor = (
  player: MyExpertPlayer,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
): string[] =>
  (matchupSignalsByPlayer.get(player.id) ?? []).map(matchup => {
    const context = matchup.label ?? (matchup.opponent ? `vs ${matchup.opponent}` : undefined);
    return context
      ? `Matchup signal ${formatSigned(matchup.score)}: ${sentenceFrom(context)}.`
      : `Matchup signal ${formatSigned(matchup.score)}.`;
  });

const newsEvidenceFor = (news: readonly MyExpertNewsSignal[]): string[] =>
  news
    .filter(item => item.impact === "positive")
    .map(item => `Positive news: ${sentenceFrom(item.headline)}.`);

export const lineupEvidenceFor = (
  player: MyExpertPlayer,
  matchupSignalsByPlayer: ReadonlyMap<string, readonly MyExpertMatchupSignal[]>,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): string[] => [
  `${formatOneDecimal(player.projectedPoints)} projected points.`,
  ...signalEvidenceFor("Opportunity", player.signals?.opportunityScore),
  ...signalEvidenceFor("Usage", player.signals?.usageScore),
  ...signalEvidenceFor("Matchup", player.signals?.matchupScore),
  ...signalEvidenceFor("Trend", player.signals?.trendScore),
  ...matchupEvidenceFor(player, matchupSignalsByPlayer),
  ...newsEvidenceFor(newsByPlayer.get(player.id) ?? []),
];

export const lineupRiskFor = (
  player: MyExpertPlayer,
  newsByPlayer: ReadonlyMap<string, readonly MyExpertNewsSignal[]>,
): string => {
  const risks = [
    ...(player.signals?.weatherRisk ? [`Weather risk -${formatOneDecimal(player.signals.weatherRisk)}.`] : []),
    ...(player.signals?.injuryRisk ? [`Injury risk -${formatOneDecimal(player.signals.injuryRisk)}.`] : []),
    ...(newsByPlayer.get(player.id) ?? [])
      .filter(item => item.impact !== "positive")
      .map(item => `${item.impact === "negative" ? "Negative" : "Watch"} news: ${sentenceFrom(item.headline)}.`),
  ];
  return risks.length ? risks.join(" ") : "No major risk flags.";
};
