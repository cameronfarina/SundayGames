import { analyzePostDraftTeam } from "../postDraftTeamAnalysis.js";
import { buildAnalysisInput } from "./analysisInput.js";
import { assertAnalysisContext } from "./context.js";
import type {
  AnalyzeEndedLiveDraftRoomTeamInput,
  PrivatePostDraftTeamResult,
} from "./contracts.js";
import { buildLiveRoomRosters } from "./rosters.js";

export const analyzeEndedLiveDraftRoomTeam = (
  input: AnalyzeEndedLiveDraftRoomTeamInput,
): PrivatePostDraftTeamResult => {
  assertAnalysisContext(input);
  const rosters = buildLiveRoomRosters(
    input.room,
    input.projectionSnapshot,
    input.ownership.teamId,
    input.ownership.ownerId,
  );
  return {
    roster: rosters.roster,
    analysis: analyzePostDraftTeam(buildAnalysisInput(input, rosters)),
  };
};
