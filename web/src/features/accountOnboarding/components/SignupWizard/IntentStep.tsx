import { useState } from "react";
import { Button, InlineNotice } from "../../../../shared/ui";
import type { AccountOnboardingIntent } from "../../../../shared/api/accountOnboarding/accountOnboardingSchema";

interface IntentStepProps {
  readonly error: string | undefined;
  readonly initialIntent: AccountOnboardingIntent | null;
  readonly onContinue: (intent: AccountOnboardingIntent) => void;
  readonly pending: boolean;
}

const options: readonly {
  description: string;
  label: string;
  value: AccountOnboardingIntent;
}[] = [{
  description: "Run mock drafts and simulations before draft day.",
  label: "Practice for a draft",
  value: "practice",
}, {
  description: "Run your league's real draft in Sunday Games.",
  label: "Host a live draft",
  value: "live_draft",
}];

export const IntentStep = ({ error, initialIntent, onContinue, pending }: IntentStepProps) => {
  const [intent, setIntent] = useState<AccountOnboardingIntent | null>(initialIntent);
  return <form aria-label="Draft setup intent" onSubmit={event => {
    event.preventDefault();
    if (intent !== null) onContinue(intent);
  }}>
    <fieldset className="signup-wizard__fieldset">
      <legend className="signup-wizard__legend">What are you setting up?</legend>
      <p className="signup-wizard__helper">
        Your answer won't change what you can do in Sunday Games. It only helps us understand
        how people use the product.
      </p>
      <div className="signup-wizard__options">
        {options.map(option => <label
          aria-label={option.label}
          className="signup-wizard__option"
          htmlFor={`signup-intent-${option.value}`}
          key={option.value}
        >
          <input
            checked={intent === option.value}
            id={`signup-intent-${option.value}`}
            name="signup-intent"
            onChange={() => { setIntent(option.value); }}
            type="radio"
            value={option.value}
          />
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </label>)}
      </div>
    </fieldset>
    {error === undefined ? null : <InlineNotice variant="error">{error}</InlineNotice>}
    <div className="signup-wizard__actions">
      <Button disabled={intent === null || pending} type="submit">
        {pending ? "Saving..." : "Continue"}
      </Button>
    </div>
  </form>;
};
