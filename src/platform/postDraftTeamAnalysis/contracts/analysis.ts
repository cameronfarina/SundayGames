import type { MyTeamOwnershipContext } from "./core.js";
import type { PostDraftProjectionProvenance } from "./projections.js";
import type { PostDraftTeamRanking, RosterAnalysisFinding } from "./ranking.js";
import type {
  CoachRecommendationReadiness,
  CoachRecommendationSet,
  PickupDropRecommendationRecord,
  StartSitRecommendationRecord,
} from "./recommendations.js";

export interface PostDraftTeamAnalysis {
  ownership: MyTeamOwnershipContext;
  generatedAt: Date;
  projectionProvenance: PostDraftProjectionProvenance;
  ranking: PostDraftTeamRanking;
  strengths: readonly RosterAnalysisFinding[];
  risks: readonly RosterAnalysisFinding[];
  recommendationReadiness: {
    startSit: CoachRecommendationReadiness;
    pickupDrop: CoachRecommendationReadiness;
  };
  recommendations: {
    startSit: CoachRecommendationSet<StartSitRecommendationRecord>;
    pickupDrop: CoachRecommendationSet<PickupDropRecommendationRecord>;
  };
}
