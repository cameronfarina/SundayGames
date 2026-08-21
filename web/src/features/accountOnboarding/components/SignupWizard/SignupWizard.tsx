import { Button, Dialog, InlineNotice } from "../../../../shared/ui";
import { useEffect, useRef, useState } from "react";
import { useSessionQuery } from "../../../auth/api/sessionQuery";
import { SignOutButton } from "../../../auth/components/SignOutButton/SignOutButton";
import type {
  AccountOnboarding,
  AccountOnboardingIntent,
  AccountOnboardingProvider,
} from "../../../../shared/api/accountOnboarding/accountOnboardingSchema";
import { useAccountOnboardingMutation } from "../../hooks/useAccountOnboardingMutation";
import { ConnectionsStep } from "./ConnectionsStep";
import { IntentStep } from "./IntentStep";
import { ProvidersStep } from "./ProvidersStep";
import "./SignupWizard.css";

type WizardStage = "intent" | "providers" | "connections";

const stepNumbers: Record<WizardStage, number> = {
  connections: 3,
  intent: 1,
  providers: 2,
};

interface ActiveSignupWizardProps {
  readonly accountId: string;
  readonly onboarding: AccountOnboarding;
  readonly stage: WizardStage;
}

const stepLabels: Record<WizardStage, string> = {
  connections: "Connect your leagues",
  intent: "What are you setting up?",
  providers: "Where are your leagues hosted?",
};

const ActiveSignupWizard = ({ accountId, onboarding, stage: savedStage }: ActiveSignupWizardProps) => {
  const mutation = useAccountOnboardingMutation(accountId);
  const [manualStep, setManualStep] = useState<Exclude<WizardStage, "connections"> | null>(null);
  const error = mutation.error?.message;
  const step = manualStep ?? savedStage;
  const currentStepNumber = stepNumbers[step];
  const previousStep = useRef(step);
  const progress = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (previousStep.current !== step) progress.current?.focus();
    previousStep.current = step;
  }, [step]);
  const saveIntent = (intent: AccountOnboardingIntent): void => {
    mutation.reset();
    mutation.mutate({ action: "set_intent", intent }, {
      onSuccess: () => {
        setManualStep(savedStage === "connections" ? "providers" : null);
      },
    });
  };
  const saveProviders = (providers: readonly AccountOnboardingProvider[]): void => {
    mutation.reset();
    mutation.mutate({ action: "set_providers", providers }, {
      onSuccess: () => { setManualStep(null); },
    });
  };

  return <Dialog
    contentClassName="signup-wizard-dialog"
    description="Answer 2 quick questions, then connect any leagues you want to bring in."
    dismissible={false}
    open
    title="Welcome to Sunday Games"
  >
    <div className="signup-wizard">
      <p
        aria-label={`Step ${String(currentStepNumber)} of 3: ${stepLabels[step]}`}
        aria-live="polite"
        className="signup-wizard__progress"
        ref={progress}
        tabIndex={-1}
      >Step {currentStepNumber} of 3</p>
      {step === "intent" ? <IntentStep
        error={error}
        initialIntent={onboarding.intent}
        onContinue={saveIntent}
        pending={mutation.isPending}
      /> : null}
      {step === "providers" ? <ProvidersStep
        error={error}
        initialProviders={onboarding.providers}
        onBack={() => { mutation.reset(); setManualStep("intent"); }}
        onContinue={saveProviders}
        pending={mutation.isPending}
      /> : null}
      {step === "connections" ? <ConnectionsStep
        error={error}
        onBack={() => { mutation.reset(); setManualStep("providers"); }}
        onFinish={() => {
          mutation.reset();
          mutation.mutate({ action: "complete" });
        }}
        pending={mutation.isPending}
        providers={onboarding.providers ?? []}
      /> : null}
    </div>
  </Dialog>;
};

export const SignupWizard = () => {
  const session = useSessionQuery();
  const sessionData = session.data;
  if (sessionData === undefined) return null;
  const onboarding = sessionData.onboarding;
  if (onboarding === undefined) return <Dialog
    contentClassName="signup-wizard-recovery-dialog"
    description="Sunday Games could not load your required setup answers."
    dismissible={false}
    open
    title="Finish account setup"
  >
    <InlineNotice variant="error">
      Setup is temporarily unavailable. Retry before continuing to Sunday Games.
    </InlineNotice>
    <div className="signup-wizard__recovery-actions">
      <Button
        disabled={session.isFetching}
        onClick={() => { void session.refetch(); }}
      >{session.isFetching ? "Retrying..." : "Try again"}</Button>
      <SignOutButton variant="secondary" />
    </div>
  </Dialog>;
  if (onboarding.stage === "complete") return null;
  return <ActiveSignupWizard
    accountId={sessionData.account.id}
    key={sessionData.account.id}
    onboarding={onboarding}
    stage={onboarding.stage}
  />;
};
