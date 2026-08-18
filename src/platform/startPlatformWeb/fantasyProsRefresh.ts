import type { FantasyProsClient } from "../../data/fantasyPros.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import {
  startFantasyProsRefreshLoop,
  type FantasyProsRefreshErrorSource,
  type FantasyProsRefreshLoop,
} from "../fantasyProsRefresh.js";

export interface StartFantasyProsRefreshInput {
  client: FantasyProsClient | undefined;
  repository: FantasyProsRepository;
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
  // Without an API key the whole feature stays dark: nothing is scheduled and
  // the repositories keep serving whatever is already stored.
  if (input.client === undefined) return undefined;

  return startFantasyProsRefreshLoop({
    client: input.client,
    repository: input.repository,
    onError: logRefreshError,
  });
};
