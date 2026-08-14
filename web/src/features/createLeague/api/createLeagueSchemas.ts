import { z } from "zod";

const scoringReviewSchema = z.object({
  pointsPerPassingYard: z.number(),
  pointsPerPassingTouchdown: z.number(),
  pointsPerRushingYard: z.number(),
  pointsPerRushingTouchdown: z.number(),
  pointsPerReceivingYard: z.number(),
  pointsPerReceivingTouchdown: z.number(),
  pointsPerReception: z.number(),
});

const reviewTeamSchema = z.object({
  externalTeamId: z.string(),
  displayName: z.string(),
  abbreviation: z.string().nullable(),
  draftOrderPosition: z.number().int().positive().nullable(),
});

const draftReviewSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("auction"),
    budgetDollars: z.number().positive(),
    minimumBidDollars: z.number().positive(),
  }),
  z.object({
    type: z.literal("snake"),
    rounds: z.number().int().positive(),
    order: z.array(z.string()),
  }),
]);

const espnReviewSchema = z.object({
  kind: z.literal("review"),
  provider: z.literal("espn"),
  confirmationRequired: z.literal(true),
  review: z.object({
    externalLeagueId: z.string(),
    season: z.number().int().positive(),
    leagueName: z.string().nullable(),
    teamCount: z.number().int().positive(),
    draft: draftReviewSchema,
    scoring: scoringReviewSchema,
    rosterSlots: z.record(z.string(), z.number().int().nonnegative()),
    teams: z.array(reviewTeamSchema),
  }),
  warnings: z.array(z.object({ code: z.string(), message: z.string() })),
});

const manualReviewSchema = z.object({
  kind: z.literal("manual-review-required"),
  provider: z.literal("espn"),
  confirmationRequired: z.literal(true),
  reason: z.enum(["private_or_unauthorized", "settings_need_review"]),
  externalLeagueId: z.string(),
  season: z.number().int().positive(),
  confirmationMethods: z.tuple([z.literal("screenshot"), z.literal("manual")]),
  message: z.string(),
});

export const espnReviewOutcomeSchema = z.discriminatedUnion("kind", [
  espnReviewSchema,
  manualReviewSchema,
]);

export const createLeagueResponseSchema = z.object({
  season: z.object({ id: z.string().min(1) }),
});
export type EspnReviewOutcome = z.infer<typeof espnReviewOutcomeSchema>;
