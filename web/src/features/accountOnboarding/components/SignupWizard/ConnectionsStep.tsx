import { useCallback, useState } from "react";
import { Button, InlineNotice } from "../../../../shared/ui";
import type { AccountOnboardingProvider } from "../../../../shared/api/accountOnboarding/accountOnboardingSchema";
import { ProviderSetupCards } from "./ProviderSetupCards";

interface ConnectionsStepProps {
  readonly error: string | undefined;
  readonly onBack: () => void;
  readonly onFinish: () => void;
  readonly pending: boolean;
  readonly providers: readonly AccountOnboardingProvider[];
}

const finishButtonLabel = (providerBusy: boolean, finishing: boolean): string => {
  if (providerBusy) return "Sync in progress...";
  return finishing ? "Finishing..." : "Finish setup";
};

export const ConnectionsStep = ({
  error,
  onBack,
  onFinish,
  pending,
  providers,
}: ConnectionsStepProps) => {
  const [espnMobile, setEspnMobile] = useState(false);
  const [busyProviders, setBusyProviders] = useState<readonly string[]>([]);
  const setProviderBusy = useCallback((provider: string, busy: boolean): void => {
    setBusyProviders(current => {
      if (busy) return [...new Set([...current, provider])];
      return current.filter(candidate => candidate !== provider);
    });
  }, []);
  const connectable = providers.some(provider => provider === "espn" || provider === "sleeper");
  const providerBusy = busyProviders.length > 0;
  return <div>
    <h2 className="signup-wizard__legend">Connect your leagues</h2>
    <p className="signup-wizard__helper">
      Connect now to bring in league settings, teams, and rosters. You can also finish setup and
      connect later.
    </p>
    {connectable ? <ProviderSetupCards
      disabled={providerBusy}
      espnMobileDeferred={espnMobile}
      onEspnMobile={() => { setEspnMobile(true); }}
      onProviderBusyChange={setProviderBusy}
      providers={providers}
    /> : null}
    {providers.includes("other") ? <section className="signup-wizard__provider-card">
      <h3>Other</h3>
      <p>
        Automatic sync isn't available for this platform yet. You can create a league manually
        after setup.
      </p>
    </section> : null}
    {providers.includes("none") ? <InlineNotice variant="info">
      No league yet—you can create one after setup or explore practice drafts and simulations.
    </InlineNotice> : null}
    <div aria-label="Setup actions" className="signup-wizard__actions" role="group">
      {error === undefined ? null : <div className="signup-wizard__action-error">
        <InlineNotice variant="error">{error}</InlineNotice>
      </div>}
      <Button disabled={pending || providerBusy} onClick={onBack} variant="secondary">Back</Button>
      <Button disabled={pending || providerBusy} onClick={onFinish}>
        {finishButtonLabel(providerBusy, pending)}
      </Button>
    </div>
  </div>;
};
