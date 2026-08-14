import { z } from "zod";

const roleSchema = z.enum(["owner", "admin", "member", "observer"]);
const membershipSchema = z.object({
  userId: z.string(),
  leagueId: z.string(),
  role: roleSchema,
  ownerId: z.string().optional(),
  teamId: z.string().optional(),
});

export const invitationDetailsSchema = z.object({
  invitation: z.object({
    id: z.string(),
    seasonId: z.string(),
    kind: z.enum(["league", "team"]),
    teamId: z.string().optional(),
  }),
  league: z.object({
    id: z.string(),
    name: z.string(),
    seasonYear: z.number().int(),
  }),
  teams: z.array(z.object({
    id: z.string(),
    ownerId: z.string(),
    name: z.string(),
    managerNames: z.array(z.string()).optional(),
    status: z.enum(["claimed", "available"]),
  })),
});

export const invitationSessionSchema = z.object({
  account: z.object({ id: z.string(), email: z.email() }),
});

export const invitationClaimResponseSchema = z.object({
  invitation: z.object({ seasonId: z.string() }).loose().optional(),
  membership: membershipSchema,
});

export const invitationOnboardingSchema = z.object({
  account: z.object({ id: z.string(), email: z.email() }),
  leagues: z.array(z.object({
    seasonId: z.string(),
    membership: z.object({ teamId: z.string().optional() }).loose(),
  }).loose()),
});

export type InvitationDetails = z.infer<typeof invitationDetailsSchema>;

export type InvitationSession =
  | { readonly status: "signed-in"; readonly account: z.infer<typeof invitationSessionSchema>["account"] }
  | { readonly status: "signed-out" };
