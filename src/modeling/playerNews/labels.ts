import type { PlayerNewsCategory, PlayerNewsDraftAction } from "./categoryContracts.js";

const actionLabels: readonly PlayerNewsDraftAction[] = [
  "Move up",
  "Watch",
  "Fade",
  "No model change",
];

export const categoryLabels: readonly PlayerNewsCategory[] = [
  "Injury",
  "Practice",
  "Transaction",
  "Depth chart",
  "Role",
  "Matchup",
  "Team context",
  "Market",
  "News",
];

export const isPlayerNewsCategory = (value: string): value is PlayerNewsCategory =>
  categoryLabels.some(category => category === value);

export const isPlayerNewsDraftAction = (value: string): value is PlayerNewsDraftAction =>
  actionLabels.some(action => action === value);
