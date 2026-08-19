import type { FantasyProsClient } from "./contracts.js";

/**
 * Minimum gap between two FantasyPros requests. A boot pass asks for
 * seventeen datasets-worth of data, and before this they left back to back as
 * fast as the network allowed, which is the shape a per-minute limiter
 * refuses. Seconds are cheap here: this is a background refresh, not a page
 * load, and nothing waits on it.
 */
export const fantasyProsRequestSpacingMs = 3_000;

export interface PacedFantasyProsClientOptions {
  spacingMs?: number | undefined;
  now?: (() => number) | undefined;
  delay?: ((ms: number) => Promise<void>) | undefined;
}

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => { setTimeout(resolve, ms); });

/**
 * Spaces requests by elapsed time rather than sleeping before each one, so a
 * naturally slow sequence waits for nothing. Wrapping the client rather than
 * the refresh loop covers every request there is — between datasets, between
 * the six projection positions, and the news pull — and leaves no code path
 * that can forget to pace itself.
 */
export const pacedFantasyProsClient = (
  client: FantasyProsClient,
  options: PacedFantasyProsClientOptions = {},
): FantasyProsClient => {
  const spacingMs = options.spacingMs ?? fantasyProsRequestSpacingMs;
  const now = options.now ?? (() => Date.now());
  const delay = options.delay ?? sleep;
  let nextAllowedAt = 0;

  // The refresh loop is the only caller and runs strictly sequentially, so one
  // stored deadline is enough. Two concurrent callers would read the same gap
  // and both proceed; there is no such caller, so there is no queue here.
  const paced = async <TResult>(run: () => Promise<TResult>): Promise<TResult> => {
    const wait = nextAllowedAt - now();
    if (wait > 0) await delay(wait);
    // Measured start to start, which is what a requests-per-minute limit counts.
    nextAllowedAt = now() + spacingMs;
    return await run();
  };

  return {
    fetchRankings: async request => await paced(async () => await client.fetchRankings(request)),
    fetchProjections: async request =>
      await paced(async () => await client.fetchProjections(request)),
    fetchPlayers: async () => await paced(async () => await client.fetchPlayers()),
    fetchNews: async request => await paced(async () => await client.fetchNews(request)),
  };
};
