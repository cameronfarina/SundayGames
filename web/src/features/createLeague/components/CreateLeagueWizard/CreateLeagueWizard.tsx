import { Button } from "../../../../shared/ui/Button/Button";
import { Dialog } from "../../../../shared/ui/Dialog/Dialog";
import { InlineNotice } from "../../../../shared/ui/InlineNotice/InlineNotice";
import { useCreateLeagueWizard } from "../../hooks/useCreateLeagueWizard";
import { WizardProgress } from "../WizardProgress/WizardProgress";
import { WizardStepContent } from "./WizardStepContent";
import "./CreateLeagueWizard.css";

interface CreateLeagueWizardProps {
  readonly onClose: () => void;
  readonly onCreated: (seasonId: string) => void;
  readonly open: boolean;
}

const formId = "create-league-step-form";

interface OpenCreateLeagueWizardProps {
  readonly onClose: () => void;
  readonly onCreated: (seasonId: string) => void;
}

const OpenCreateLeagueWizard = ({ onClose, onCreated }: OpenCreateLeagueWizardProps) => {
  const controller = useCreateLeagueWizard(onCreated);
  const footer = (
    <div className="create-league-footer">
      <Button disabled={controller.isFirstStep || controller.creation.isPending} onClick={controller.back} variant="secondary">
        Back
      </Button>
      {controller.draft.step === "teams" ? (
        <Button
          aria-busy={controller.creation.isPending}
          disabled={!controller.canFinish || controller.creation.isPending}
          form={formId}
          type="submit"
        >
          {controller.creation.isPending ? "Creating league" : "Finish"}
        </Button>
      ) : (
        <Button
          disabled={!controller.canAdvance || controller.creation.isPending}
          form={formId}
          type="submit"
        >
          Next
        </Button>
      )}
    </div>
  );

  return (
    <Dialog
      description="Review each section before we create your league."
      footer={footer}
      onOpenChange={onClose}
      open
      title="Input league info"
    >
      <div className="create-league-wizard">
        <WizardProgress
          current={controller.draft.step}
          onNavigate={controller.goToStep}
          visited={controller.visitedSteps}
        />
        {controller.creation.error !== null && (
          <InlineNotice variant="error">{controller.creation.error.message}</InlineNotice>
        )}
        <WizardStepContent controller={controller} formId={formId} />
      </div>
    </Dialog>
  );
};

export const CreateLeagueWizard = (props: CreateLeagueWizardProps) => {
  if (!props.open) return null;
  return <OpenCreateLeagueWizard onClose={props.onClose} onCreated={props.onCreated} />;
};
