import type { Owner } from "../../../config/league.js";
import type { LeagueSyncProviderStatusReport } from "../../modeling/leagueSync.js";
import type {
  MyExpertAdviceCard,
  MyExpertPlayer,
  buildMyExpertAdvice,
} from "../../modeling/myExpert.js";

export interface MyExpertRecommendation {
  id: string;
  type: MyExpertAdviceCard["type"];
  priority: MyExpertAdviceCard["priority"];
  title: string;
  detail: string;
  players: MyExpertPlayer[];
  suggestedAdds: MyExpertPlayer[];
  suggestedDrops: MyExpertPlayer[];
  reasons: string[];
  actionLabel: string;
  readOnly: true;
  lineup?: MyExpertAdviceCard["lineup"];
}

export interface MyExpertResponse {
  mode: "advice-only";
  readOnly: true;
  generatedAt: string;
  source: { key: string; label: string; readOnly: true; detail: string };
  team: { owner: Owner; rosteredCount: number; rosteredValue: number; players: MyExpertPlayer[] };
  summary: { currentWeek: number; recommendationCount: number; highPriorityCount: number };
  recommendations: MyExpertRecommendation[];
  integrations: LeagueSyncProviderStatusReport[];
  policy: ReturnType<typeof buildMyExpertAdvice>["policy"];
}
