import type { DraftPlanCandidate } from "../contracts.js";
import type { CoachSlotDefinition } from "../internalContracts.js";
import { playerAtPosition } from "../players.js";

export const coachCohortLimit = 12;

export const coachSlotDefinitions: readonly CoachSlotDefinition[] = [
  {
    slot: "RB1",
    position: "RB",
    playerForCandidate: candidate => candidate.rbCore[0],
    note: "Primary RB spend lane from the best sampled builds.",
  },
  {
    slot: "RB2",
    position: "RB",
    playerForCandidate: candidate => candidate.rbCore[1],
    note: "Second RB lane that keeps the three-RB structure alive.",
  },
  {
    slot: "RB3",
    position: "RB",
    playerForCandidate: candidate => candidate.rbCore[2],
    note: "Flex RB lane; this is where the plan absorbs expensive early buys.",
  },
  {
    slot: "WR1",
    position: "WR",
    playerForCandidate: candidate => playerAtPosition(candidate, "WR", 0),
    note: "WR1 pocket from winning builds after RB spend is protected.",
  },
  {
    slot: "WR2",
    position: "WR",
    playerForCandidate: candidate => playerAtPosition(candidate, "WR", 1),
    note: "WR2 pocket that prevents a panic buy after RB spend.",
  },
  {
    slot: "TE",
    position: "TE",
    playerForCandidate: candidate => playerAtPosition(candidate, "TE", 0),
    note: "TE lane; expensive TE only makes sense if the core came in under budget.",
  },
];

export const topCoachCandidates = (
  candidates: readonly DraftPlanCandidate[],
): DraftPlanCandidate[] =>
  candidates.slice(0, Math.min(candidates.length, coachCohortLimit));
