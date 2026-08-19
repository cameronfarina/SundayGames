import { z } from "zod";
import { playerPositionSchema } from "./myTeamCommonSchemas";

const rosterSchema = z.object({
  rosterSize: z.number().int().nonnegative(),
  lineupSlotCount: z.number().int().nonnegative(),
  lineup: z.record(z.string(), z.number().int().nonnegative()),
});

const auctionSettingsSchema = z.object({
  draftFormat: z.literal("auction").optional(),
  auction: z.object({
    budgetDollars: z.number().nonnegative(),
    minimumBidDollars: z.number().positive(),
  }),
  roster: rosterSchema,
});

const snakeSettingsSchema = z.object({
  draftFormat: z.literal("snake"),
  snake: z.object({
    rounds: z.number().int().positive(),
    order: z.array(z.string()),
  }),
  roster: rosterSchema,
});

export const seasonTeamSchema = z.object({
  season: z.object({
    id: z.string(),
    leagueId: z.string(),
    seasonYear: z.number().int(),
    setupStatus: z.enum(["draft", "published", "locked"]),
    teams: z.array(z.object({
      id: z.string(),
      ownerId: z.string(),
      ownerDisplayName: z.string(),
      displayName: z.string(),
      draftOrderPosition: z.number().int().positive(),
    })),
    settings: z.union([auctionSettingsSchema, snakeSettingsSchema]),
  }),
});

export const keepersSchema = z.object({
  keepers: z.array(z.object({
    teamId: z.string(),
    playerId: z.string().optional(),
    playerName: z.string(),
    position: playerPositionSchema,
    price: z.number().nonnegative(),
    keeperRound: z.number().int().positive().optional(),
    source: z.literal("keeper"),
  })),
});

export type SeasonTeam = z.output<typeof seasonTeamSchema>;
export type Keeper = z.output<typeof keepersSchema>["keepers"][number];
