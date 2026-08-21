import { useState } from "react";
import { Button, InlineNotice } from "../../../../shared/ui";
import type { AccountOnboardingProvider } from "../../../../shared/api/accountOnboarding/accountOnboardingSchema";

interface ProvidersStepProps {
  readonly error: string | undefined;
  readonly initialProviders: readonly AccountOnboardingProvider[] | null;
  readonly onBack: () => void;
  readonly onContinue: (providers: readonly AccountOnboardingProvider[]) => void;
  readonly pending: boolean;
}

const options: readonly { label: string; value: AccountOnboardingProvider }[] = [
  { label: "ESPN", value: "espn" },
  { label: "Sleeper", value: "sleeper" },
  { label: "Other", value: "other" },
  { label: "I don't have a league yet", value: "none" },
];

export const ProvidersStep = ({
  error,
  initialProviders,
  onBack,
  onContinue,
  pending,
}: ProvidersStepProps) => {
  const [selected, setSelected] = useState<readonly AccountOnboardingProvider[]>(
    initialProviders ?? [],
  );
  const toggle = (provider: AccountOnboardingProvider): void => {
    if (provider === "none") {
      setSelected(selected.includes("none") ? [] : ["none"]);
      return;
    }
    const withoutNone = selected.filter(candidate => candidate !== "none");
    setSelected(withoutNone.includes(provider)
      ? withoutNone.filter(candidate => candidate !== provider)
      : [...withoutNone, provider]);
  };
  return <form aria-label="League platforms" onSubmit={event => {
    event.preventDefault();
    if (selected.length > 0) onContinue(selected);
  }}>
    <fieldset className="signup-wizard__fieldset">
      <legend className="signup-wizard__legend">Where are your leagues hosted?</legend>
      <p className="signup-wizard__helper">Select all that apply.</p>
      <div className="signup-wizard__options signup-wizard__options--grid">
        {options.map(option => <label
          aria-label={option.label}
          className="signup-wizard__option"
          htmlFor={`signup-provider-${option.value}`}
          key={option.value}
        >
          <input
            checked={selected.includes(option.value)}
            id={`signup-provider-${option.value}`}
            onChange={() => { toggle(option.value); }}
            type="checkbox"
          />
          <span><strong>{option.label}</strong></span>
        </label>)}
      </div>
    </fieldset>
    {error === undefined ? null : <InlineNotice variant="error">{error}</InlineNotice>}
    <div className="signup-wizard__actions">
      <Button disabled={pending} onClick={onBack} variant="secondary">Back</Button>
      <Button disabled={selected.length === 0 || pending} type="submit">
        {pending ? "Saving..." : "Continue"}
      </Button>
    </div>
  </form>;
};
