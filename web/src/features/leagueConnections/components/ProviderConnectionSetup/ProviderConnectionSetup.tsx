import { InlineNotice } from "../../../../shared/ui";
import { useEffect, useState } from "react";
import type { ConnectionCredentials } from "../../api/leagueConnectionsApi";
import type { LeagueConnection, LeagueConnectionProviderInfo } from "../../api/leagueConnectionsSchema";
import {
  currentLeagueSeason,
  useAddConnectionForm,
} from "../../hooks/useAddConnectionForm";
import type { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { DiscoveredLeagueList } from "../AddConnection/DiscoveredLeagueList";
import { HandleForm } from "../AddConnection/HandleForm";
import { EspnAccountOptions } from "./EspnAccountOptions";
import "../AddConnection/AddConnection.css";
import "./ProviderConnectionSetup.css";

interface ProviderConnectionSetupProps {
  readonly connections: readonly LeagueConnection[];
  readonly disabled?: boolean;
  readonly espnMobileDeferred?: boolean;
  readonly headingLevel?: 3 | 4;
  readonly mutations: ReturnType<typeof useLeagueConnectionMutations>;
  readonly onBusyChange?: (provider: string, busy: boolean) => void;
  readonly onEspnMobile?: () => void;
  readonly provider: LeagueConnectionProviderInfo;
}

export const ProviderConnectionSetup = ({
  connections,
  disabled = false,
  espnMobileDeferred = false,
  headingLevel = 3,
  mutations,
  onBusyChange,
  onEspnMobile,
  provider,
}: ProviderConnectionSetupProps) => {
  const [extensionReading, setExtensionReading] = useState(false);
  const form = useAddConnectionForm(
    [provider],
    mutations,
    connections,
    provider.provider,
  );
  const localBusy = mutations.discover.isPending || form.importing || extensionReading;
  const busy = disabled || localBusy;
  useEffect(() => {
    onBusyChange?.(provider.provider, localBusy);
    return () => { onBusyChange?.(provider.provider, false); };
  }, [localBusy, onBusyChange, provider.provider]);
  const espn = provider.provider === "espn";
  const discoveryError = mutations.discover.error;
  const noResults = mutations.discover.isSuccess && form.leagues.length === 0 && !localBusy;
  if (provider.availability !== "connectable") {
    return <InlineNotice variant="warning">{provider.detail}</InlineNotice>;
  }
  const findAccountLeagues = (credentials?: ConnectionCredentials) => {
    form.findLeaguesWithCredentials(credentials);
  };
  const handleForm = <HandleForm
    handle={form.handle}
    inputId={`connection-handle-${provider.provider}`}
    onHandleChange={form.setHandle}
    onSubmit={form.findLeagues}
    pending={busy}
    provider={provider}
    submitLabel="Find my leagues"
  />;

  return <div className="provider-connection-setup">
    {espn ? null : <>
      <p className="provider-connection-setup__intro">
        Enter your Sleeper username to find your 2026 leagues. No password is required.
      </p>
      {handleForm}
    </>}
    {espn ? <EspnAccountOptions
      disabled={busy}
      espnMobileDeferred={espnMobileDeferred}
      espnS2={form.espnS2}
      headingLevel={headingLevel}
      onBusyChange={setExtensionReading}
      onCredentials={findAccountLeagues}
      onEspnMobile={onEspnMobile}
      onEspnS2Change={form.setEspnS2}
      onSwidChange={form.setSwid}
      swid={form.swid}
    /> : null}
    {discoveryError === null
      ? null
      : <InlineNotice variant="error">{discoveryError.message}</InlineNotice>}
    {noResults ? <InlineNotice variant="info">
      {espn
        ? `No ${currentLeagueSeason} ESPN leagues were found. ` +
          "For a private account, sign into ESPN and copy fresh cookie values."
        : `No ${currentLeagueSeason} Sleeper leagues were found for that username.`}
    </InlineNotice> : null}
    <DiscoveredLeagueList
      leagues={form.leagues}
      onImport={form.importLeague}
      onImportAll={form.importAll}
      running={busy}
      states={form.leagueStates}
    />
  </div>;
};
