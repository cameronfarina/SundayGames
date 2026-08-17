import { z } from "zod";
import { PlatformApiError } from "../../../shared/api/http/PlatformApiError";

const blockedApplyBodySchema = z.object({
  import: z.object({
    blockers: z.array(z.object({
      code: z.string(),
      message: z.string(),
      rowNumber: z.number().optional(),
    })),
  }),
});

export type ApplyBlocker = z.output<typeof blockedApplyBodySchema>["import"]["blockers"][number];

export const applyBlockers = (error: unknown): readonly ApplyBlocker[] => {
  if (!(error instanceof PlatformApiError) || error.code !== "league_setup_import_blocked") return [];
  const parsed = blockedApplyBodySchema.safeParse(error.body);
  return parsed.success ? parsed.data.import.blockers : [];
};
