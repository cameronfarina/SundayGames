import type { Owner, Position } from "../../../config/league.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { flexEligiblePositions, premiumPositions } from "./constants.js";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const isFlexEligible = (position: Position): boolean =>
  flexEligiblePositions.some(flexPosition => flexPosition === position);

export const isPremiumPosition = (position: Position): boolean =>
  premiumPositions.some(premiumPosition => premiumPosition === position);

export const rosterMaximumFor = (
  owner: Owner,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  const globalMaximum = config.rosterMaximums[position];
  const ownerMaximum = config.ownerRosterMaximums[owner]?.[position] ?? globalMaximum;

  return Math.max(config.starterMinimums[position], Math.min(globalMaximum, ownerMaximum));
};
