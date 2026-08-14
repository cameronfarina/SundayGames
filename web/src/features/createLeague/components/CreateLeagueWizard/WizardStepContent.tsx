import type { useCreateLeagueWizard } from "../../hooks/useCreateLeagueWizard";
import { BasicsStep } from "../steps/BasicsStep";
import { ReferenceStep } from "../steps/ReferenceStep";
import { RosterStep } from "../steps/RosterStep";
import { ScoringStep } from "../steps/ScoringStep";
import { TeamsStep } from "../steps/TeamsStep";

interface WizardStepContentProps {
  readonly controller: ReturnType<typeof useCreateLeagueWizard>;
  readonly formId: string;
}

export const WizardStepContent = ({ controller, formId }: WizardStepContentProps) => {
  if (controller.draft.step === "basics") return (
    <BasicsStep
      dispatch={controller.dispatch}
      draft={controller.draft}
      errors={controller.visibleErrors}
      formId={formId}
      onSubmit={controller.next}
    />
  );
  if (controller.draft.step === "reference") return (
    <ReferenceStep
      dispatch={controller.dispatch}
      draft={controller.draft}
      error={controller.review.error}
      formId={formId}
      isPending={controller.review.isPending}
      onReview={() => {
        controller.review.mutate({
          leagueIdOrUrl: controller.draft.referenceSource,
          season: controller.draft.seasonYear,
        });
      }}
      onSourceChange={value => {
        controller.review.reset();
        controller.dispatch({ type: "set-reference-source", value });
      }}
      onSubmit={controller.next}
      outcome={controller.review.data}
    />
  );
  if (controller.draft.step === "scoring") return (
    <ScoringStep
      dispatch={controller.dispatch}
      draft={controller.draft}
      errors={controller.visibleErrors}
      formId={formId}
      onSubmit={controller.next}
    />
  );
  if (controller.draft.step === "roster") return (
    <RosterStep
      dispatch={controller.dispatch}
      draft={controller.draft}
      errors={controller.visibleErrors}
      formId={formId}
      onSubmit={controller.next}
    />
  );
  return (
    <TeamsStep
      dispatch={controller.dispatch}
      draft={controller.draft}
      formId={formId}
      onSubmit={controller.finish}
      showErrors={controller.showTeamErrors}
    />
  );
};
