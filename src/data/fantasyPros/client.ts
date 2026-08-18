import type {
  FantasyProsClient,
  FantasyProsClientOptions,
  FantasyProsPlayer,
  FantasyProsProjectionSet,
  FantasyProsProjectionsRequest,
  FantasyProsRankingSet,
  FantasyProsRankingsRequest,
} from "./contracts.js";
import {
  parseFantasyProsPlayers,
  parseFantasyProsProjections,
  parseFantasyProsRankings,
} from "./parse.js";

export const fantasyProsBaseUrl = "https://api.fantasypros.com/public/v2/json";
export const fantasyProsSeason = 2026;
export const fantasyProsRequestTimeoutMs = 10_000;

// Rest-of-season rankings and projections are both requested as week 0.
export const fantasyProsRestOfSeasonWeek = 0;

const searchParams = (entries: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) params.set(key, value);
  }
  return params.toString();
};

export const createFantasyProsClient = (
  options: FantasyProsClientOptions,
): FantasyProsClient => {
  const baseUrl = options.baseUrl ?? fantasyProsBaseUrl;
  const season = options.season ?? fantasyProsSeason;
  const timeoutMs = options.timeoutMs ?? fantasyProsRequestTimeoutMs;
  const fetchImplementation = options.fetchImplementation ?? fetch;

  const requestJson = async (path: string, query: string): Promise<unknown> => {
    // Without a deadline a stalled FantasyPros response holds a refresh open forever.
    const response = await fetchImplementation(`${baseUrl}${path}?${query}`, {
      headers: { accept: "application/json", "x-api-key": options.apiKey },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`FantasyPros request to ${path} failed with ${response.status}.`);
    }
    return await response.json();
  };

  return {
    fetchRankings: async (
      request: FantasyProsRankingsRequest,
    ): Promise<FantasyProsRankingSet> => {
      const scoring = request.scoring ?? "PPR";
      const week = request.week ?? fantasyProsRestOfSeasonWeek;
      const payload = await requestJson(`/nfl/${season}/consensus-rankings`, searchParams({
        position: "ALL",
        type: request.type,
        scoring,
        ...(request.week === undefined ? {} : { week: String(request.week) }),
      }));
      return parseFantasyProsRankings(payload, { type: request.type, scoring, week });
    },

    fetchProjections: async (
      request: FantasyProsProjectionsRequest,
    ): Promise<FantasyProsProjectionSet> => {
      const payload = await requestJson(`/nfl/${season}/projections`, searchParams({
        position: request.position,
        week: String(request.week),
        scoring: request.scoring ?? "PPR",
      }));
      return parseFantasyProsProjections(payload, {
        position: request.position,
        week: request.week,
      });
    },

    // The player catalog is not season-scoped; /nfl/<year>/players is not a route.
    fetchPlayers: async (): Promise<readonly FantasyProsPlayer[]> =>
      parseFantasyProsPlayers(await requestJson("/nfl/players", searchParams({}))),
  };
};
