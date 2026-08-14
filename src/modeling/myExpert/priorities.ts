import { highLineupEdge, mediumLineupEdge } from "./constants.js";
import type { MyExpertNewsSignal, MyExpertPriority } from "./contracts.js";

export const priorityForGain = (gain: number): MyExpertPriority => {
  if (gain >= 6) return "high";
  if (gain >= 3) return "medium";
  return "low";
};

export const priorityForWeek = (currentWeek: number, week: number): MyExpertPriority => {
  if (week <= currentWeek + 1) return "high";
  if (week <= currentWeek + 2) return "medium";
  return "low";
};

export const priorityForNews = (news: MyExpertNewsSignal): MyExpertPriority => {
  const severity = news.severity ?? (news.impact === "negative" ? 3 : 2);
  if (severity >= 4 || news.impact === "negative") return "high";
  if (severity >= 2 || news.impact === "watch") return "medium";
  return "low";
};

export const priorityForLineupEdge = (edge: number): MyExpertPriority => {
  if (edge >= highLineupEdge) return "high";
  if (edge >= mediumLineupEdge) return "medium";
  return "low";
};
