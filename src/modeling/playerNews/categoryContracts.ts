export type PlayerNewsCategory =
  | "Injury"
  | "Practice"
  | "Transaction"
  | "Depth chart"
  | "Role"
  | "Matchup"
  | "Team context"
  | "Market"
  | "News";

export type PlayerNewsDraftAction = "Move up" | "Watch" | "Fade" | "No model change";
export type PlayerNewsAvailabilityStatus = "available" | "drafted" | "keeper" | "unavailable";
export type PlayerNewsSourceMode = "local" | "rotowire-rss" | "all";
