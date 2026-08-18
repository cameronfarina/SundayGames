import { z } from "zod";

export const snakeCommandSchema = z.discriminatedUnion("type", [
  z.object({ expectedRevision: z.number().int(), type: z.literal("start") }),
  z.object({
    expectedRevision: z.number().int(),
    playerId: z.string().min(1),
    type: z.literal("pick"),
  }),
  z.object({ expectedRevision: z.number().int(), type: z.literal("undo") }),
  z.object({ expectedRevision: z.number().int(), type: z.literal("complete") }),
]);

const selectionSchema = z.object({
  playerId: z.string().min(1),
  rosterSlot: z.string().min(1),
  source: z.enum(["ai", "human", "keeper"]),
});

const pickRefSchema = z.object({
  overall: z.number().int().positive(),
  pickInRound: z.number().int().positive(),
  round: z.number().int().positive(),
  teamId: z.string().min(1),
});

export const snakeBoardPickSchema = pickRefSchema.extend({
  selection: selectionSchema.optional(),
  teamName: z.string().min(1),
});

export const snakeBoardPlayerSchema = z.object({
  adp: z.number(),
  available: z.boolean(),
  byeWeek: z.number().int().positive().optional(),
  id: z.string().min(1),
  leagueExpectedPick: z.number(),
  name: z.string().min(1),
  personalRank: z.number().optional(),
  position: z.string().min(1),
  rank: z.number(),
  reachLimit: z.number().optional(),
  teamAbbreviation: z.string().optional(),
  week1Projection: z.number().optional(),
});

export const snakeTeamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  roster: z.array(selectionSchema),
  slots: z.array(z.object({
    eligiblePositions: z.array(z.string()),
    playerId: z.string().min(1).optional(),
    slot: z.string().min(1),
  })),
});

export const snakeStateSchema = z.object({
  board: z.object({
    picks: z.array(snakeBoardPickSchema),
    players: z.array(snakeBoardPlayerSchema),
  }),
  session: z.object({
    canComplete: z.boolean(),
    canUndo: z.boolean(),
    currentPick: pickRefSchema.optional(),
    humanTeamId: z.string().min(1),
    id: z.string().min(1),
    orderType: z.enum(["standard", "third_round_reversal"]),
    revision: z.number().int().nonnegative(),
    rounds: z.number().int().positive(),
    status: z.enum(["setup", "active", "completed"]),
    teamOrder: z.array(z.string().min(1)),
  }),
  teams: z.array(snakeTeamSchema),
});

export type SnakeBoardPick = z.infer<typeof snakeBoardPickSchema>;
export type SnakeBoardPlayer = z.infer<typeof snakeBoardPlayerSchema>;
export type SnakeCommand = z.infer<typeof snakeCommandSchema>;
export type SnakeState = z.infer<typeof snakeStateSchema>;
export type SnakeTeam = z.infer<typeof snakeTeamSchema>;
