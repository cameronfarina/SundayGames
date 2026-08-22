import { InlineNotice } from "../../../../shared/ui";
import { ProviderConnectionSetup } from "../../../leagueConnections/components/ProviderConnectionSetup/ProviderConnectionSetup";
import { useLeagueConnectionMutations } from "../../../leagueConnections/hooks/useLeagueConnectionMutations";
import { useLeagueConnectionsQuery } from "../../../leagueConnections/hooks/useLeagueConnectionQueries";
import type { AccountOnboardingProvider } from "../../../../shared/api/accountOnboarding/accountOnboardingSchema";
import type {
  LeagueConnection,
  LeagueConnectionProviderInfo,
} from "../../../leagueConnections/api/leagueConnectionsSchema";

interface ProviderSetupCardsProps {
  readonly disabled: boolean;
  readonly espnMobileDeferred: boolean;
  readonly onEspnMobile: () => void;
  readonly onProviderBusyChange: (provider: string, busy: boolean) => void;
  readonly providers: readonly AccountOnboardingProvider[];
}

interface SetupCardProps {
  readonly connections: readonly LeagueConnection[];
  readonly disabled: boolean;
  readonly espnMobileDeferred: boolean;
  readonly info: LeagueConnectionProviderInfo;
  readonly onEspnMobile: () => void;
  readonly onProviderBusyChange: (provider: string, busy: boolean) => void;
}

const SetupCard = ({
  connections,
  disabled,
  espnMobileDeferred,
  info,
  onEspnMobile,
  onProviderBusyChange,
}: SetupCardProps) => {
  const mutations = useLeagueConnectionMutations();
  return <section className="signup-wizard__provider-card">
    <h3>{info.label}</h3>
    <ProviderConnectionSetup
      connections={connections}
      disabled={disabled}
      espnMobileDeferred={espnMobileDeferred}
      headingLevel={4}
      mutations={mutations}
      {...(info.provider === "espn" ? { onEspnMobile } : {})}
      onBusyChange={onProviderBusyChange}
      provider={info}
    />
  </section>;
};

export const ProviderSetupCards = ({
  disabled,
  espnMobileDeferred,
  onEspnMobile,
  onProviderBusyChange,
  providers,
}: ProviderSetupCardsProps) => {
  const connections = useLeagueConnectionsQuery();
  if (connections.isPending) return <p role="status">Loading connection options...</p>;
  if (connections.isError) {
    return <InlineNotice variant="error">
      League connection options could not load. You can finish setup and connect later.
    </InlineNotice>;
  }
  return <div className="signup-wizard__provider-list">
    {providers.filter(provider => provider === "espn" || provider === "sleeper").map(provider => {
      const info = connections.data.providers.find(candidate => candidate.provider === provider);
      if (info === undefined) return <InlineNotice key={provider} variant="warning">
        {provider === "espn" ? "ESPN" : "Sleeper"} sync is not available right now.
      </InlineNotice>;
      return <SetupCard
        connections={connections.data.connections}
        disabled={disabled}
        espnMobileDeferred={espnMobileDeferred}
        info={info}
        key={provider}
        onEspnMobile={onEspnMobile}
        onProviderBusyChange={onProviderBusyChange}
      />;
    })}
  </div>;
};
