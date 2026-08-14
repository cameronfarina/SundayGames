import { z } from "zod";
import {
  playerPositionSchema,
  readinessReasonSchema,
  recommendationReadinessSchema,
} from "./myTeamCommonSchemas";

const rosterPlayerSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: playerPositionSchema,
});

const findingSchema = z.object({
  code: z.string(),
  component: z.string(),
  summary: z.string(),
  evidence: z.string(),
});

const rankingSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    rank: z.number().int().positive(),
    teamCount: z.number().int().positive(),
    overallScore: z.number(),
  }),
  z.object({
    status: z.literal("unavailable"),
    teamCount: z.number().int().nonnegative(),
    reasons: z.array(readinessReasonSchema),
  }),
]);

const startSitRecordSchema = z.object({
  recommendationId: z.string(),
  slot: z.string(),
  start: rosterPlayerSchema.extend({ projectedPoints: z.number() }),
  explanation: z.string(),
});

const pickupDropRecordSchema = z.object({
  recommendationId: z.string(),
  add: rosterPlayerSchema.extend({ projectedPoints: z.number() }),
  drop: rosterPlayerSchema.extend({ projectedPoints: z.number() }),
  projectedPointGain: z.number(),
  explanation: z.string(),
});

export const postDraftSchema = z.object({
  roster: z.object({
    teamId: z.string(),
    ownerId: z.string(),
    players: z.array(rosterPlayerSchema),
  }),
  analysis: z.object({
    projectionProvenance: z.object({
      snapshotId: z.string(),
      generatedAt: z.string(),
      validThrough: z.string(),
      source: z.object({ kind: z.enum(["weekly_scoring_specific", "static_fallback"]) }).optional(),
    }),
    ranking: rankingSchema,
    strengths: z.array(findingSchema),
    risks: z.array(findingSchema),
    recommendationReadiness: z.object({
      startSit: recommendationReadinessSchema,
      pickupDrop: recommendationReadinessSchema,
    }),
    recommendations: z.object({
      startSit: recommendationReadinessSchema.extend({ records: z.array(startSitRecordSchema) }),
      pickupDrop: recommendationReadinessSchema.extend({ records: z.array(pickupDropRecordSchema) }),
    }),
  }),
});

export type PostDraftTeam = z.output<typeof postDraftSchema>;
