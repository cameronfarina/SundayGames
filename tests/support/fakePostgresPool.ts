import type {
  PostgresNotification,
  PostgresPoolClientLike,
  PostgresPoolLike,
} from "../../src/platform/postgresClient.js";

export class FakeConnectedClient implements PostgresPoolClientLike {
  readonly queries: { text: string; values: readonly unknown[] }[] = [];
  readonly notificationListeners = new Set<(notification: PostgresNotification) => void>();
  readonly errorListeners = new Set<(error: Error) => void>();
  released = false;
  failNextQuery: Error | undefined;

  onNotification(listener: (notification: PostgresNotification) => void): void {
    this.notificationListeners.add(listener);
  }

  removeNotificationListener(listener: (notification: PostgresNotification) => void): void {
    this.notificationListeners.delete(listener);
  }

  onError(listener: (error: Error) => void): void {
    this.errorListeners.add(listener);
  }

  removeErrorListener(listener: (error: Error) => void): void {
    this.errorListeners.delete(listener);
  }

  emitNotification(channel: string, payload: string): void {
    for (const listener of this.notificationListeners) listener({ channel, payload });
  }

  emitError(error: Error): void {
    if (this.errorListeners.size === 0) throw error;
    for (const listener of this.errorListeners) listener(error);
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: TRow[]; rowCount: number }> {
    this.queries.push({ text, values });
    if (this.failNextQuery !== undefined) {
      const error = this.failNextQuery;
      this.failNextQuery = undefined;
      throw error;
    }
    return { rows: [], rowCount: 1 };
  }

  release(): void {
    this.released = true;
  }
}

export class FakePool implements PostgresPoolLike {
  readonly connectedClient = new FakeConnectedClient();
  readonly queries: { text: string; values: readonly unknown[] }[] = [];
  ended = false;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: TRow[]; rowCount: number }> {
    this.queries.push({ text, values });
    return { rows: [], rowCount: 1 };
  }

  async connect(): Promise<PostgresPoolClientLike> {
    return this.connectedClient;
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}
