import type {
  SleeperSyncPreviewLeague,
  SleeperSyncPreviewProvider,
  SleeperSyncPreviewResponse,
} from "../contracts.js";
import { unknownField } from "../unknownRecord.js";

const apiBaseUrl = "https://api.sleeper.app/v1";

const stringField = (value: unknown, key: string): string | undefined => {
  const field = unknownField(value, key);
  return typeof field === "string" && field.trim() ? field.trim() : undefined;
};

const numberField = (value: unknown, key: string): number | undefined => {
  const field = unknownField(value, key);
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
};

const fetchJson = async (path: string): Promise<unknown> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { accept: "application/json" },
  });
  if (response.status === 404) throw new Error("Sleeper could not find that username or league.");
  if (!response.ok) throw new Error(`Sleeper request failed with ${response.status}.`);
  return response.json();
};

const leagueFor = (value: unknown): SleeperSyncPreviewLeague | undefined => {
  const leagueId = stringField(value, "league_id");
  if (!leagueId) return undefined;
  const name = stringField(value, "name") ?? leagueId;
  const status = stringField(value, "status");
  const season = stringField(value, "season");
  const totalRosters = numberField(value, "total_rosters");
  return {
    leagueId,
    name,
    ...(status ? { status } : {}),
    ...(season ? { season } : {}),
    ...(totalRosters === undefined ? {} : { totalRosters }),
  };
};

const userFor = (value: unknown): SleeperSyncPreviewResponse["user"] | undefined => {
  const userId = stringField(value, "user_id");
  if (!userId) return undefined;
  const username = stringField(value, "username");
  const displayName = stringField(value, "display_name");
  return {
    userId,
    ...(username ? { username } : {}),
    ...(displayName ? { displayName } : {}),
  };
};

export const defaultSleeperSyncPreviewProvider: SleeperSyncPreviewProvider = async ({
  identifier,
  season,
}) => {
  const cleanIdentifier = identifier.trim();
  if (!cleanIdentifier) throw new Error("Sleeper username or league ID is required.");
  if (/^\d{6,}$/.test(cleanIdentifier)) {
    const league = leagueFor(await fetchJson(`/league/${encodeURIComponent(cleanIdentifier)}`));
    if (!league) throw new Error("Sleeper league response did not include a league ID.");
    return {
      provider: "sleeper",
      readOnly: true,
      identifier: cleanIdentifier,
      season,
      resolvedAs: "league",
      message: `Found ${league.name}.`,
      leagues: [league],
    };
  }

  const user = userFor(await fetchJson(`/user/${encodeURIComponent(cleanIdentifier)}`));
  if (!user) throw new Error("Sleeper user response did not include a user ID.");
  const rawLeagues = await fetchJson(
    `/user/${encodeURIComponent(user.userId)}/leagues/nfl/${encodeURIComponent(season)}`,
  );
  const leagues: SleeperSyncPreviewLeague[] = [];
  if (Array.isArray(rawLeagues)) {
    for (const rawLeague of rawLeagues) {
      const league = leagueFor(rawLeague);
      if (league) leagues.push(league);
    }
  }
  return {
    provider: "sleeper",
    readOnly: true,
    identifier: cleanIdentifier,
    season,
    resolvedAs: "user",
    user,
    message: leagues.length === 1
      ? "Found 1 Sleeper league."
      : leagues.length > 1
        ? `Found ${leagues.length} Sleeper leagues.`
        : "No Sleeper leagues found for that season.",
    leagues,
  };
};
