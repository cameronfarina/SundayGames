import type {
  ClaimFantasyProsRefreshInput,
  FantasyProsDatasetStatus,
  FantasyProsProjectionsQuery,
  FantasyProsRankingsQuery,
  FantasyProsRepository,
  RecordFantasyProsRefreshOutcomeInput,
  SaveFantasyProsPlayersInput,
  SaveFantasyProsProjectionsInput,
  SaveFantasyProsRankingsInput,
} from "./contracts.js";
import type {
  FantasyProsDataset,
  FantasyProsStoredPlayer,
  FantasyProsStoredProjection,
  FantasyProsStoredRanking,
} from "./records.js";
import { retryTimestamp } from "./retrySchedule.js";

interface FetchLogEntry {
  lastFetchedAt: string;
  lastSucceededAt?: string | undefined;
  requestCount: number;
  rowCount: number;
  lastError?: string | undefined;
}

const rankingKey = (ranking: FantasyProsStoredRanking): string =>
  `${ranking.rankingType}\0${ranking.scoring}\0${ranking.week}\0${ranking.playerId}`;

const projectionKey = (projection: FantasyProsStoredProjection): string =>
  `${projection.week}\0${projection.playerId}`;


export class InMemoryFantasyProsRepository implements FantasyProsRepository {
  readonly #rankings = new Map<string, FantasyProsStoredRanking>();
  readonly #projections = new Map<string, FantasyProsStoredProjection>();
  readonly #players = new Map<number, FantasyProsStoredPlayer>();
  readonly #fetchLog = new Map<FantasyProsDataset, FetchLogEntry>();

  async saveRankings(input: SaveFantasyProsRankingsInput): Promise<void> {
    for (const ranking of input.rankings) {
      const stored: FantasyProsStoredRanking = {
        ...ranking,
        rankingType: input.rankingType,
        scoring: input.scoring,
        week: input.week,
        fetchedAt: input.fetchedAt,
      };
      this.#rankings.set(rankingKey(stored), stored);
    }
  }

  async rankings(query: FantasyProsRankingsQuery): Promise<readonly FantasyProsStoredRanking[]> {
    return [...this.#rankings.values()]
      .filter(ranking => ranking.rankingType === query.rankingType &&
        (query.week === undefined || ranking.week === query.week))
      .sort((left, right) => left.rankEcr - right.rankEcr);
  }

  async saveProjections(input: SaveFantasyProsProjectionsInput): Promise<void> {
    for (const projection of input.projections) {
      const stored: FantasyProsStoredProjection = {
        ...projection,
        week: input.week,
        fetchedAt: input.fetchedAt,
      };
      this.#projections.set(projectionKey(stored), stored);
    }
  }

  async projections(
    query: FantasyProsProjectionsQuery,
  ): Promise<readonly FantasyProsStoredProjection[]> {
    return [...this.#projections.values()]
      .filter(projection => projection.week === query.week &&
        (query.position === undefined || projection.position === query.position))
      .sort((left, right) => (right.pointsPpr ?? 0) - (left.pointsPpr ?? 0));
  }

  async savePlayers(input: SaveFantasyProsPlayersInput): Promise<void> {
    for (const player of input.players) {
      this.#players.set(player.playerId, { ...player, fetchedAt: input.fetchedAt });
    }
  }

  async playersByIds(playerIds: readonly number[]): Promise<readonly FantasyProsStoredPlayer[]> {
    return playerIds.flatMap(playerId => {
      const player = this.#players.get(playerId);
      return player === undefined ? [] : [player];
    });
  }

  async players(): Promise<readonly FantasyProsStoredPlayer[]> {
    return [...this.#players.values()];
  }

  async claimRefresh(input: ClaimFantasyProsRefreshInput): Promise<boolean> {
    const entry = this.#fetchLog.get(input.dataset);
    const nowIso = input.now.toISOString();
    if (entry !== undefined &&
      Date.parse(entry.lastFetchedAt) > input.now.getTime() - input.cadenceMs) {
      return false;
    }
    this.#fetchLog.set(input.dataset, {
      ...entry ?? { requestCount: 0, rowCount: 0 },
      lastFetchedAt: nowIso,
    });
    return true;
  }

  async recordRefreshOutcome(input: RecordFantasyProsRefreshOutcomeInput): Promise<void> {
    const entry = this.#fetchLog.get(input.dataset) ??
      { lastFetchedAt: input.now.toISOString(), requestCount: 0, rowCount: 0 };
    this.#fetchLog.set(input.dataset, {
      lastFetchedAt: retryTimestamp(input) ?? entry.lastFetchedAt,
      requestCount: entry.requestCount + input.requestCount,
      rowCount: input.rowCount ?? entry.rowCount,
      ...(input.error === undefined
        ? { lastSucceededAt: input.now.toISOString() }
        : { lastSucceededAt: entry.lastSucceededAt, lastError: input.error }),
    });
  }

  async datasetStatuses(): Promise<readonly FantasyProsDatasetStatus[]> {
    return [...this.#fetchLog.entries()].map(([dataset, entry]) => ({
      dataset,
      lastFetchedAt: entry.lastFetchedAt,
      lastSucceededAt: entry.lastSucceededAt,
      requestCount: entry.requestCount,
      rowCount: entry.rowCount,
      lastError: entry.lastError,
    }));
  }
}
