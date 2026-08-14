export interface PostgresQueryResult<TRow = Record<string, unknown>> {
  rows: TRow[];
  rowCount?: number | null | undefined;
}

export interface PostgresQueryClient {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
}

export interface PostgresPlatformStoreOptions {
  snapshotKey?: string | undefined;
  now?: (() => Date) | undefined;
}
