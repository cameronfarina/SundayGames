export interface ScoringRule {
  readonly label: string;
  readonly points: number;
}

export interface ScoringSummary {
  /** The rules a manager checks first, in the order they read in. */
  readonly headline: readonly ScoringRule[];
  readonly all: readonly ScoringRule[];
}

/* Providers ship dozens of keys, most of them kicking distances and defensive
   points-allowed bands. Only the scoring a manager actually compares leagues on
   is named here; the rest stay readable without a map of every provider key. */
const headlineLabels: ReadonlyMap<string, string> = new Map([
  ["rec", "Reception"],
  ["pass_yd", "Passing yard"],
  ["pass_td", "Passing TD"],
  ["pass_int", "Interception thrown"],
  ["rush_yd", "Rushing yard"],
  ["rush_td", "Rushing TD"],
  ["rec_yd", "Receiving yard"],
  ["rec_td", "Receiving TD"],
  ["fum_lost", "Fumble lost"],
]);

const humanized = (key: string): string => {
  const words = key.replace(/_/gu, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const summarizeScoring = (
  scoring: Readonly<Record<string, number>>,
): ScoringSummary => {
  const headline: ScoringRule[] = [];
  for (const [key, label] of headlineLabels) {
    const points = scoring[key];
    if (points !== undefined) headline.push({ label, points });
  }

  const all = Object.entries(scoring)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, points]) => ({ label: headlineLabels.get(key) ?? humanized(key), points }));

  return { all, headline };
};

export const describeScoringRules = (rules: readonly ScoringRule[]): string =>
  rules.map(rule => `${rule.label} ${String(rule.points)}`).join(" · ");

export const allScoringRulesLabel = (rules: readonly ScoringRule[]): string =>
  `All ${String(rules.length)} scoring ${rules.length === 1 ? "rule" : "rules"}`;
