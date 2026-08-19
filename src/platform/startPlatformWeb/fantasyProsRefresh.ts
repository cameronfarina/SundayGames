import type { FantasyProsClient } from "../../data/fantasyPros.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import {
  fantasyProsDatasetRefreshes,
  startFantasyProsRefreshLoop,
  type FantasyProsRefreshErrorSource,
  type FantasyProsRefreshLoop,
} from "../fantasyProsRefresh.js";
import type { PlayerNewsRepository } from "../playerNews.js";
import { playerNewsDatasetRefreshes } from "../playerNewsRefresh.js";

export interface StartFantasyProsRefreshInput {
  client: FantasyProsClient | undefined;
  repository: FantasyProsRepository;
  playerNewsRepository: PlayerNewsRepository;
  playerNewsEnabled: boolean;
}

const logRefreshError = (source: FantasyProsRefreshErrorSource, error: unknown): void => {
  // Matches the structured stderr shape the platform already uses for
  // background failures, so Render logs stay greppable.
  console.error(JSON.stringify({
    event: "fantasy_pros_refresh_failed",
    source,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
};

export const startFantasyProsRefreshIfConfigured = (
  input: StartFantasyProsRefreshInput,
): FantasyProsRefreshLoop | undefined => {
  // Without an API key the FantasyPros datasets stay dark, but RotoWire news
  // needs no key and the page no longer fetches on the request path, so news
  // keeps its own switch rather than riding on the key.
  const entries = [
    ...(input.client === undefined
      ? []
      : fantasyProsDatasetRefreshes({ client: input.client, repository: input.repository })),
    ...(input.playerNewsEnabled
      ? playerNewsDatasetRefreshes({
        newsRepository: input.playerNewsRepository,
        fantasyProsRepository: input.repository,
        ...(input.client === undefined ? {} : { fantasyProsClient: input.client }),
      })
      : []),
  ];
  if (entries.length === 0) return undefined;

  return startFantasyProsRefreshLoop({
    repository: input.repository,
    entries,
    onError: logRefreshError,
  });
};
