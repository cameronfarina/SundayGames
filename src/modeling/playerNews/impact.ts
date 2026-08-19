import type { PlayerContextEvidence } from "../../../config/playerContext.js";
import type { RawPlayerNewsItem } from "../../data/playerNewsProviderAdapters.js";
import type { PlayerNewsCategory, PlayerNewsDraftAction } from "./categoryContracts.js";
import { categoryLabels, isPlayerNewsCategory } from "./labels.js";

export const evidenceCategoryFor = (evidence: PlayerContextEvidence): PlayerNewsCategory => {
  const text = `${evidence.category} ${evidence.note ?? ""}`.toLowerCase();
  if (/injur|hamstring|knee|ankle|shoulder|foot|pcl|practice|limited|illness|holdout|suspend|jail/.test(text)) {
    return "Injury";
  }
  if (/depth chart|depth-chart/.test(text)) return "Depth chart";
  if (/contract|trade|sign|free agent|waiver|departed/.test(text)) return "Transaction";

  switch (evidence.category) {
    case "opportunity":
    case "skillFit":
      return "Role";
    case "defensiveAttention":
      return "Matchup";
    case "environment":
      return "Team context";
    case "risk":
      return "Market";
  }
};

const confirmedFadeText = (text: string): boolean =>
  /\b(ruled out|out for|will miss|expected to miss|set to miss|not expected to play|placed on ir|injured reserve|season-ending|multi-week|multiple weeks|surgery|torn|fracture|suspended for|serving (?:a )?suspension|will serve (?:a )?suspension)\b/.test(text);

const watchRiskText = (text: string): boolean =>
  /\b(limited|missed practice|misses practice|not practicing|sidelined|injur|hamstring|knee|ankle|shoulder|foot|undisclosed|recovery|questionable|day-to-day)\b/.test(text);

export const actionForEvidenceImpact = (
  impactScore: number,
  text = "",
): PlayerNewsDraftAction => {
  if (impactScore >= 0.85) return "Move up";
  if (impactScore < 0 && confirmedFadeText(text)) return "Fade";
  if (Math.abs(impactScore) >= 0.35) return "Watch";
  return "No model change";
};

export const actionForRawNews = (item: RawPlayerNewsItem): PlayerNewsDraftAction => {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  if (confirmedFadeText(text)) return "Fade";
  if (watchRiskText(text)) return "Watch";
  if (/starter|first-team|role|signed|traded/.test(text)) return "Watch";
  return "No model change";
};

/**
 * A provider that labels its own items is believed over the text match, and the
 * most actionable label wins: FantasyPros tags a torn ACL "Commentary, News,
 * Injury", and only the last of those is worth surfacing. categoryLabels is
 * already ordered most to least actionable.
 */
export const categoryForRawNews = (item: RawPlayerNewsItem): PlayerNewsCategory => {
  const provided = item.categories ?? [];
  const ranked = categoryLabels.find(label => provided.includes(label));
  return ranked ?? item.tags.find(isPlayerNewsCategory) ?? "News";
};
