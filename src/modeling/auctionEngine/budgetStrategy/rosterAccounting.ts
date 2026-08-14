import type { Position } from "../../../../config/league.js";
import type { Player } from "../../../types.js";
import { anchorBuildPriceThreshold } from "../constants.js";

export const anchorRosterCount = (roster: readonly Player[]): number =>
  roster.filter(player => player.price >= anchorBuildPriceThreshold).length;

export const positionAnchorRosterCount = (
  roster: readonly Player[],
  position: Position,
): number =>
  roster.filter(player =>
    player.position === position && player.price >= anchorBuildPriceThreshold
  ).length;

export const positionRosterCount = (
  roster: readonly Player[],
  position: Position,
): number =>
  roster.filter(player => player.position === position).length;

export const positionSpend = (
  roster: readonly Player[],
  position: Position,
): number =>
  roster
    .filter(player => player.position === position)
    .reduce((total, player) => total + player.price, 0);
