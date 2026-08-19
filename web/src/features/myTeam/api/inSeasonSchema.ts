import { z } from "zod";
import { playerPositionSchema } from "./myTeamCommonSchemas";

const rankViewSchema = z.object({
  rankEcr: z.number(),
  positionRank: z.string().optional(),
  tier: z.number().optional(),
  rankMin: z.number().optional(),
  rankMax: z.number().optional(),
  rankStandardDeviation: z.number().optional(),
  ecrDelta: z.number().optional(),
});

const playerNewsSchema = z.object({
  headline: z.string(),
  publishedAt: z.string(),
  injury: z.boolean(),
});

const inSeasonPlayerSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: playerPositionSchema,
  teamAbbreviation: z.string().optional(),
  byeWeek: z.number().optional(),
  fantasyProsPlayerId: z.number().optional(),
  weekly: rankViewSchema.optional(),
  restOfSeason: rankViewSchema.optional(),
  weeklyProjectedPoints: z.number().optional(),
  restOfSeasonProjectedPoints: z.number().optional(),
  news: playerNewsSchema.optional(),
});

const lineupSlotSchema = z.object({
  slot: z.string(),
  eligiblePositions: z.array(playerPositionSchema),
  start: inSeasonPlayerSchema,
  bench: inSeasonPlayerSchema.optional(),
  pointEdge: z.number().optional(),
  concern: z.object({
    basis: z.enum(["weekly_ecr", "rest_of_season_rank"]),
    rankGap: z.number(),
    message: z.string(),
  }).optional(),
});

export const inSeasonSchema = z.object({
  configured: z.boolean(),
  week: z.number().optional(),
  updatedAt: z.string().optional(),
  players: z.array(inSeasonPlayerSchema),
  lineup: z.object({
    basis: z.enum(["weekly_projection", "rest_of_season_projection"]),
    slots: z.array(lineupSlotSchema),
  }).optional(),
  waivers: z.object({
    source: z.enum(["waiver_rankings", "widely_available"]),
    ownershipThreshold: z.number().optional(),
    players: z.array(inSeasonPlayerSchema.extend({
      waiverRank: z.number().optional(),
      ownedEspn: z.number().optional(),
    })),
  }),
});

export type InSeasonTeam = z.output<typeof inSeasonSchema>;
export type InSeasonPlayer = z.output<typeof inSeasonPlayerSchema>;
export type InSeasonLineupSlot = z.output<typeof lineupSlotSchema>;
export type InSeasonWaiverPlayer = InSeasonTeam["waivers"]["players"][number];
export type InSeasonPlayerNews = z.output<typeof playerNewsSchema>;
