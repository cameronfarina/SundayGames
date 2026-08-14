import type {
  MockDraftScriptBuildAround,
  MockDraftScriptTargetMaxBid,
} from "./contracts.js";

export const scriptLabelFor = (
  targets: readonly MockDraftScriptTargetMaxBid[],
  buildAround?: MockDraftScriptBuildAround,
): string => [
  ...(buildAround
    ? [`Build around ${buildAround.player} at ${buildAround.prices.map(price => `$${price}`).join("/")}`]
    : []),
  ...targets.map(target => `Target ${target.player} up to $${target.maxBid}`),
].join(" / ");
