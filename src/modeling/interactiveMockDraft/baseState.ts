import type { Owner } from "../../../config/league.js";
import type {
  InteractiveMockDraftPhase,
  InteractiveMockDraftState,
} from "./contracts.js";
import { topTargetsFor } from "./draftStateQueries.js";
import type { PreparedInteractiveMockDraft } from "./preparedContract.js";

export const baseStateFor = ({
  phase,
  prepared,
  watchOwner,
  seed,
  pickNumber,
  nominationCursor,
  message,
}: {
  phase: InteractiveMockDraftPhase;
  prepared: PreparedInteractiveMockDraft;
  watchOwner: Owner;
  seed: string;
  pickNumber: number;
  nominationCursor: number;
  message?: string;
}): InteractiveMockDraftState => ({
  phase,
  watchOwner,
  strategy: prepared.liveState.strategy,
  scenario: prepared.scenario,
  seed,
  pickNumber,
  commandCount: prepared.liveState.events.length,
  nominationCursor,
  aiBids: [],
  topTargets: topTargetsFor(prepared.liveState),
  shortlist: prepared.liveState.shortlist,
  ...(message === undefined ? {} : { message }),
});
