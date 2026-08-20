import type { SyncedLeagueSettings } from "./contracts.js";
import { optionalNumber, recordValue, textValue } from "./decode.js";

/**
 * "linear" is Sleeper's snake that never reverses. Sunday Games runs one snake
 * format, so both arrive as the same draft type; a draft Sleeper has not typed
 * yet names no format and the import asks the owner instead.
 */
const sleeperDraftType = (value: unknown): "auction" | "snake" | undefined => {
  const type = textValue(value).toLowerCase();
  if (type === "auction") return "auction";
  return type === "snake" || type === "linear" ? "snake" : undefined;
};

/**
 * Sleeper keeps the draft in its own resource and starts a fresh league id for
 * each dynasty season, so a league has one draft; a second entry is a rebuilt
 * board for the same season and describes the same settings.
 */
export const sleeperDraftSettings = (
  drafts: readonly Record<string, unknown>[],
  leagueSettings: Record<string, unknown>,
): Pick<
  SyncedLeagueSettings,
  "auctionBudget" | "draftType" | "keeperCount" | "snakeRounds"
> => {
  const settings = recordValue(recordValue(drafts[0]).settings);
  const draftType = sleeperDraftType(recordValue(drafts[0]).type);
  const auctionBudget = optionalNumber(settings.budget);
  const snakeRounds = optionalNumber(settings.rounds);
  const keeperCount = optionalNumber(leagueSettings.max_keepers);

  return {
    ...(draftType === undefined ? {} : { draftType }),
    ...(auctionBudget === undefined ? {} : { auctionBudget }),
    ...(snakeRounds === undefined ? {} : { snakeRounds }),
    ...(keeperCount === undefined ? {} : { keeperCount }),
  };
};
