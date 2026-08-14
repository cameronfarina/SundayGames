import type { OwnerProfileData } from "./contracts.js";

export const describeProfile = (profile: OwnerProfileData): string => {
  const { QB, RB, WR, TE } = profile.openAuctionSpend;

  if (profile.averageKeeperCost >= 40) return "expensive-keeper dependent";
  if (QB <= 4 && WR >= 100) return "extreme wait-on-QB, WR-heavy";
  if (QB >= 28 && TE >= 28) return "balanced premium QB/TE";
  if (WR >= 135 && profile.topTwoConcentration >= 60) return "extreme WR stars and scrubs";
  if (WR >= 120 && RB <= 45) return "extreme WR concentration";
  if (WR >= 120 && profile.topTwoConcentration >= 58) return "WR stars and scrubs";
  if (RB >= 115 && profile.topTwoConcentration >= 58) return "RB stars and scrubs";
  if (RB >= 105 && profile.topTwoConcentration >= 50) return "concentrated RB-heavy";
  if (RB >= 100) return "deep RB-heavy";
  if (RB >= 90 && QB >= 20) return "RB concentration plus paid QB";
  if (RB >= 80 && TE >= 24 && QB >= 18) return "RB plus premium TE/QB";
  if (WR >= 85 && TE >= 18) return "flexible WR-leaning hybrid";
  if (QB <= 9 && WR >= 85) return "low-QB, slight WR lean";
  if (WR >= 85) return "balanced with WR preference";
  return "balanced";
};
