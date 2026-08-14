import type { PostgresQueryResult } from "../postgresPlatformStore.js";

export const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined =>
  result.rows[0];
