export class InMemoryLeagueConnectionSyncRevisions {
  readonly #byConnectionId = new Map<string, number>();

  recordSavedConnection(connectionId: string): void {
    const current = this.#byConnectionId.get(connectionId);
    this.#byConnectionId.set(connectionId, current === undefined ? 0 : current + 1);
  }

  begin(connectionId: string): string | null {
    const current = this.#byConnectionId.get(connectionId);
    if (current === undefined) return null;
    const next = current + 1;
    this.#byConnectionId.set(connectionId, next);
    return String(next);
  }

  advance(connectionId: string): void {
    const current = this.#byConnectionId.get(connectionId);
    if (current !== undefined) this.#byConnectionId.set(connectionId, current + 1);
  }

  matches(connectionId: string, revision: string): boolean {
    return String(this.#byConnectionId.get(connectionId) ?? 0) === revision;
  }

  delete(connectionId: string): void {
    this.#byConnectionId.delete(connectionId);
  }
}
