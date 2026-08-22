import { leagueImportConversion } from "../../../leagueImportFromSync.js";
import type { LeagueImportConversion } from "../../../leagueImportFromSync.js";
import type { LeagueConnection, StoredLeagueSnapshot } from "../../../leagueConnections.js";
import { syncLeagueConnection, type LeagueSyncServiceOptions } from "../../../leagueSyncService.js";
import type { LeagueDraftOverride } from "./importModes.js";

const settingsWithDraft = (
  settings: StoredLeagueSnapshot["settings"],
  draft: LeagueDraftOverride | undefined,
): StoredLeagueSnapshot["settings"] => {
  if (draft === undefined) return settings;
  return draft.type === "auction"
    ? {
        ...settings,
        draftType: "auction",
        auctionBudget: draft.budgetDollars,
        minimumBid: draft.minimumBidDollars,
      }
    : { ...settings, draftType: "snake", snakeRounds: draft.rounds };
};

const conversionFor = (
  connection: LeagueConnection,
  snapshot: StoredLeagueSnapshot,
  draft: LeagueDraftOverride | undefined,
): LeagueImportConversion => leagueImportConversion({
  provider: connection.provider,
  providerLeagueId: connection.providerLeagueId,
  settings: settingsWithDraft(snapshot.settings, draft),
  teams: snapshot.teams,
});

/** A legacy snapshot gets one provider refresh before asking the owner to intervene. */
export const refreshedLeagueImportConversion = async (
  options: LeagueSyncServiceOptions,
  connection: LeagueConnection,
  snapshot: StoredLeagueSnapshot,
  now: Date,
  draft: LeagueDraftOverride | undefined,
): Promise<LeagueImportConversion | null> => {
  const conversion = conversionFor(connection, snapshot, draft);
  if (conversion.status !== "blocked") return conversion;
  const synced = await syncLeagueConnection(options, connection, now);
  if (synced.connection === null) return null;
  if (synced.snapshot === undefined) return conversion;
  return conversionFor(synced.connection, synced.snapshot, draft);
};
