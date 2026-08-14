import { maximumRetainedTerminalJobsPerUser } from "../jobHistory.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";

export const pruneTerminalHistory = async (
  userId: string,
  client: PostgresQueryClient,
): Promise<void> => {
  await client.query(
    `
DELETE FROM jobs
WHERE id IN (
  SELECT id
  FROM jobs
  WHERE user_id = $1
    AND status IN ('completed', 'failed', 'canceled')
  ORDER BY created_at DESC, id DESC
  OFFSET $2
);
`.trim(),
    [userId, maximumRetainedTerminalJobsPerUser],
  );
};
