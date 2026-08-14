import { z } from "zod";

const scoringSchema = z.object({
  passingYards: z.number(),
  passingTouchdown: z.number(),
  rushingYards: z.number(),
  rushingTouchdown: z.number(),
  receivingYards: z.number(),
  receivingTouchdown: z.number(),
  reception: z.number(),
});

const rosterSchema = z.object({
  rosterSize: z.number().int().positive(),
  lineup: z.record(z.string(), z.number()),
  lineupSlotCount: z.number().int().nonnegative(),
  rosterMaximums: z.record(z.string(), z.number()),
});

const keeperPolicySchema = z.object({
  mode: z.literal("previous-cost-multiplier"),
  multiplier: z.number().positive(),
  rounding: z.literal("ceil"),
});

const settingsCore = {
  expectedTeamCount: z.number().int().positive(),
  roster: rosterSchema,
  keeperPolicy: keeperPolicySchema,
};

const auctionSettingsSchema = z.object({
  ...settingsCore,
  draftFormat: z.literal("auction"),
  scoring: scoringSchema,
  auction: z.object({
    budgetDollars: z.number().positive(),
    minimumBidDollars: z.number().positive(),
  }),
});

const snakeSettingsSchema = z.object({
  ...settingsCore,
  draftFormat: z.literal("snake"),
  scoring: scoringSchema,
  snake: z.object({
    rounds: z.number().int().positive(),
    order: z.array(z.string()),
    reversal: z.enum(["standard", "third-round"]),
  }),
});

const legacyAuctionSettingsSchema = z.object({
  ...settingsCore,
  auction: z.object({
    budgetDollars: z.number().positive(),
    minimumBidDollars: z.number().positive(),
  }),
});

export const leagueSeasonSettingsSchema = z.union([
  auctionSettingsSchema,
  snakeSettingsSchema,
  legacyAuctionSettingsSchema,
]);

export type LeagueSeasonSettings = z.infer<typeof leagueSeasonSettingsSchema>;
