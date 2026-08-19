import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useReducer, useState } from "react";
import { onboardingQueryKey } from "../../../shared/api/onboarding/onboardingQuery";
import { createLeague, reviewEspnLeague } from "../api/createLeagueApi";
import type { EspnReviewInput } from "../api/createLeagueApi";
import type { EspnReviewOutcome } from "../api/createLeagueSchemas";
import { createInitialLeagueDraft, leagueDraftReducer } from "../model/createLeagueDraft";
import type { ConfirmedLeagueSetup, WizardStep } from "../model/createLeagueTypes";
import {
  basicsErrors,
  createLeagueSetup,
  isLeagueDraftComplete,
  rosterErrors,
  scoringErrors,
} from "../model/createLeagueValidation";

const steps: readonly WizardStep[] = ["basics", "reference", "scoring", "roster", "teams"];
const nextStepByStep: Readonly<Record<WizardStep, WizardStep>> = {
  basics: "reference", reference: "scoring", scoring: "roster", roster: "teams", teams: "teams",
};
const previousStepByStep: Readonly<Record<WizardStep, WizardStep>> = {
  basics: "basics", reference: "basics", scoring: "reference", roster: "scoring", teams: "roster",
};

const hasErrors = (errors: Readonly<Record<string, string>>): boolean =>
  Object.keys(errors).length > 0;

export const useCreateLeagueWizard = (onCreated: (seasonId: string) => void) => {
  const queryClient = useQueryClient();
  const [draft, dispatch] = useReducer(
    leagueDraftReducer,
    new Date().getFullYear(),
    createInitialLeagueDraft,
  );
  const [attemptedStep, setAttemptedStep] = useState<WizardStep>();
  const [maxVisitedIndex, setMaxVisitedIndex] = useState(0);
  const review = useMutation<EspnReviewOutcome, Error, EspnReviewInput>({
    mutationFn: input => reviewEspnLeague(input),
  });
  const creation = useMutation({
    mutationFn: (setup: ConfirmedLeagueSetup) => createLeague(setup),
    onSuccess: async response => {
      await queryClient.invalidateQueries({ queryKey: onboardingQueryKey() });
      onCreated(response.season.id);
    },
  });
  const currentIndex = steps.indexOf(draft.step);
  const visibleErrors = attemptedStep === draft.step
    ? draft.step === "basics" ? basicsErrors(draft)
      : draft.step === "scoring" ? scoringErrors(draft)
        : draft.step === "roster" ? rosterErrors(draft) : {}
    : {};
  const stepIsValid = draft.step === "basics" ? !hasErrors(basicsErrors(draft))
    : draft.step === "reference" ? draft.referenceMode !== "undecided"
      : draft.step === "scoring" ? !hasErrors(scoringErrors(draft))
        : draft.step === "roster" ? !hasErrors(rosterErrors(draft)) : isLeagueDraftComplete(draft);

  const goTo = (step: WizardStep) => {
    setAttemptedStep(undefined);
    setMaxVisitedIndex(current => Math.max(current, steps.indexOf(step)));
    dispatch({ type: "go-to-step", step });
  };
  const next = () => {
    if (!stepIsValid) {
      setAttemptedStep(draft.step);
      return;
    }
    goTo(nextStepByStep[draft.step]);
  };
  const back = () => {
    goTo(previousStepByStep[draft.step]);
  };
  const finish = () => {
    if (!isLeagueDraftComplete(draft)) {
      setAttemptedStep("teams");
      return;
    }
    creation.mutate(createLeagueSetup(draft));
  };

  return {
    back,
    canAdvance: draft.step !== "reference" || draft.referenceMode !== "undecided",
    canFinish: isLeagueDraftComplete(draft),
    creation,
    dispatch,
    draft,
    finish,
    goToStep: goTo,
    isFirstStep: currentIndex === 0,
    next,
    review,
    showTeamErrors: attemptedStep === "teams",
    visibleErrors,
    visitedSteps: steps.slice(0, maxVisitedIndex + 1),
  };
};
