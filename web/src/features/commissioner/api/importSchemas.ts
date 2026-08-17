import { z } from "zod";
import { seasonSchema } from "./seasonSchemas";
import { invitationSchema } from "./workspaceSchemas";

const issueSchema = z.object({
  code: z.string(),
  message: z.string(),
  rowNumber: z.number().optional(),
});

const setupImportSchema = z.object({
  status: z.enum(["ready", "blocked"]),
  blockers: z.array(issueSchema),
  records: z.array(z.object({
    sourceRowNumber: z.number(),
    ownerDisplayName: z.string(),
    managerDisplayNames: z.array(z.string()).optional(),
    abbreviation: z.string().optional(),
    teamDisplayName: z.string(),
    email: z.string().optional(),
    role: z.enum(["owner", "admin", "member", "observer"]),
  })),
});

const teamAssignmentSchema = z.object({
  sourceRowNumber: z.number(),
  ownerDisplayName: z.string(),
  teamDisplayName: z.string(),
  effect: z.enum(["kept", "renamed", "new"]),
  existingTeamId: z.string().optional(),
  previousOwnerDisplayName: z.string().optional(),
  previousTeamDisplayName: z.string().optional(),
});

export type TeamAssignment = z.output<typeof teamAssignmentSchema>;

export const setupPreviewResponseSchema = z.object({
  import: setupImportSchema,
  teamAssignments: z.array(teamAssignmentSchema),
});

export const setupApplyResponseSchema = z.object({
  season: seasonSchema,
  import: setupImportSchema,
  invitations: z.array(invitationSchema),
  invitationFailures: z.array(z.object({
    email: z.string(),
    teamId: z.string(),
    message: z.string(),
  })),
});

const historicalIssueSchema = z.object({ code: z.string(), message: z.string() });

export const historicalPreviewResponseSchema = z.object({
  source: z.object({
    sourceWarnings: z.array(historicalIssueSchema).optional(),
    publicValueComparisonCount: z.number().optional(),
  }),
  batch: z.object({
    id: z.string(),
    status: z.enum(["previewed", "blocked", "committed", "superseded"]),
    blockers: z.array(historicalIssueSchema),
    warnings: z.array(historicalIssueSchema),
    rows: z.array(z.object({
      blockers: z.array(historicalIssueSchema),
      identityAudit: z.object({ sourceOwnerOrTeamLabel: z.string() }).optional(),
    })),
  }),
});

export const historicalCommitResponseSchema = z.object({
  batch: z.object({ id: z.string(), status: z.literal("committed") }),
  committedRecords: z.array(z.object({ playerName: z.string() })),
});

export type HistoricalPreview = z.infer<typeof historicalPreviewResponseSchema>;
