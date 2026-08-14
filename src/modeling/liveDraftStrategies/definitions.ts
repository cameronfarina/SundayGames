import type { LiveDraftStrategyDefinition, LiveDraftStrategyKey } from "./contracts.js";

export const liveDraftStrategies: Record<LiveDraftStrategyKey, LiveDraftStrategyDefinition> = {
  balanced: {
    key: "balanced",
    label: "Balanced",
    starterPremium: { QB: 4, RB: 4, WR: 4, TE: 3, K: -1, DST: -1 },
    depthPremium: { RB: 1, WR: 1, TE: 0 },
    needMultiplier: { QB: 0.45, RB: 0.45, WR: 0.45, TE: 0.35, K: -0.4, DST: -0.4 },
    tags: {},
  },
  "three-rb": {
    key: "three-rb",
    label: "True 3RB",
    starterPremium: { QB: 3, RB: 6, WR: 3, TE: 2, K: -1, DST: -1 },
    depthPremium: { RB: 4, WR: 3, TE: 2 },
    needMultiplier: { QB: 0.4, RB: 0.75, WR: 0.25, TE: 0.2, K: -0.4, DST: -0.4 },
    tags: { RB: "3RB core" },
    anchorTargets: { RB: 3 },
  },
  "hero-rb": {
    key: "hero-rb",
    label: "Hero RB",
    starterPremium: { QB: 3, RB: 5, WR: 5, TE: 3, K: -1, DST: -1 },
    depthPremium: { RB: -1, WR: 3, TE: 1 },
    needMultiplier: { QB: 0.4, RB: 0.35, WR: 0.65, TE: 0.25, K: -0.4, DST: -0.4 },
    tags: { RB: "hero RB", WR: "WR support" },
    anchorTargets: { RB: 1 },
  },
  "wr-heavy": {
    key: "wr-heavy",
    label: "WR Heavy",
    starterPremium: { QB: 3, RB: 3, WR: 7, TE: 3, K: -1, DST: -1 },
    depthPremium: { RB: 1, WR: 5, TE: 2 },
    needMultiplier: { QB: 0.4, RB: 0.2, WR: 0.8, TE: 0.25, K: -0.4, DST: -0.4 },
    tags: { WR: "WR core" },
    anchorTargets: { WR: 3 },
  },
};

export const defaultLiveDraftStrategyKey: LiveDraftStrategyKey = "three-rb";
const strategyKeys: readonly LiveDraftStrategyKey[] = ["balanced", "three-rb", "hero-rb", "wr-heavy"];

export const liveDraftStrategyFor = (key: LiveDraftStrategyKey): LiveDraftStrategyDefinition =>
  liveDraftStrategies[key];

export const parseLiveDraftStrategyKey = (value: unknown): LiveDraftStrategyKey =>
  typeof value === "string" && strategyKeys.some(key => key === value)
    ? value
    : defaultLiveDraftStrategyKey;
