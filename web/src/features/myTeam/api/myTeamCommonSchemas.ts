import { z } from "zod";

export const playerPositionSchema = z.enum(["QB", "RB", "WR", "TE", "K", "DST"]);

export const readinessReasonSchema = z.object({
  code: z.string(),
  input: z.string().optional(),
  message: z.string(),
  snapshotId: z.string().optional(),
  playerIds: z.array(z.string()).optional(),
});

export const recommendationReadinessSchema = z.object({
  status: z.enum(["ready", "stale", "unavailable"]),
  reasons: z.array(readinessReasonSchema),
  snapshotIds: z.array(z.string()),
});
