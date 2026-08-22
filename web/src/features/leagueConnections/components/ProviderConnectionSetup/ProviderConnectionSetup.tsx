import { Button, InlineNotice } from "../../../../shared/ui";
import { useEffect, useRef, useState } from "react";
import { PlatformApiError } from "../../../../shared/api/http/PlatformApiError";
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
  const [privateOptionsRevealed, setPrivateOptionsRevealed] = useState(false);
  const privateHeadingRef = useRef<HTMLHeadingElement>(null);
  const privateOptionsAnnounced = useRef(false);
  useEffect(() => {
    onBusyChange?.(provider.provider, localBusy);
    return () => { onBusyChange?.(provider.provider, false); };
  }, [localBusy, onBusyChange, provider.provider]);
  const espn = provider.provider === "espn";
  const discoveryError = mutations.discover.error;
  const privateAccessError = espn
    && discoveryError instanceof PlatformApiError
    && (discoveryError.code === "credentials_required"
      || discoveryError.code === "credentials_rejected")
    ? discoveryError
    : null;
  const privateLeague = form.handle.trim().length > 0
    && form.leagues.length === 0
    && (privateAccessError !== null || privateOptionsRevealed);
  const noResults = mutations.discover.isSuccess && form.leagues.length === 0 && !localBusy;
  const PrivateHeading = headingLevel === 4 ? "h4" : "h3";
  useEffect(() => {
    if (!privateLeague || privateOptionsAnnounced.current) return;
    privateOptionsAnnounced.current = true;
    privateHeadingRef.current?.focus();
  }, [privateLeague]);
  if (provider.availability !== "connectable") {
    return <InlineNotice variant="warning">{provider.detail}</InlineNotice>;
  }
  const retryPrivateLeague = () => {
    setPrivateOptionsRevealed(true);
    form.findLeagues();
  };
  const findPrivateLeague = (credentials?: ConnectionCredentials) => {
    form.findLeaguesWithCredentials(credentials);
  };
  const changeHandle = (value: string) => {
    form.setHandle(value);
    if (!espn) return;
    setPrivateOptionsRevealed(false);
    privateOptionsAnnounced.current = false;
    mutations.discover.reset();
  };
  const handleForm = <HandleForm
    handle={form.handle}
    inputId={`connection-handle-${provider.provider}`}
    onHandleChange={changeHandle}
    onSubmit={form.findLeagues}
    pending={busy}
    provider={provider}
    submitLabel={espn ? "Find this league" : "Find my leagues"}
  />;

  return <div className="provider-connection-setup">
    {espn ? handleForm : <>
      <p className="provider-connection-setup__intro">
        Enter your Sleeper username to find your 2026 leagues. No password is required.
      </p>
      {handleForm}
    </>}
    {privateLeague ? <section className="espn-private-options">
      <PrivateHeading ref={privateHeadingRef} tabIndex={-1}>This ESPN league is private</PrivateHeading>
      <p>
        Make it publicly viewable and try again, or use the account connection below to find every
        current-season ESPN league.
      </p>
      <p>
        In ESPN, go to League, Settings, Basic Settings, then Edit Basic Settings. Set Public
        viewability to Yes and save.
      </p>
      <Button disabled={busy} onClick={retryPrivateLeague} variant="secondary">Try again</Button>
    </section> : null}
    {espn ? <EspnAccountOptions
      disabled={busy}
      espnMobileDeferred={espnMobileDeferred}
      espnS2={form.espnS2}
      headingLevel={headingLevel}
      onBusyChange={setExtensionReading}
      onCredentials={findPrivateLeague}
      onEspnMobile={onEspnMobile}
      onEspnS2Change={form.setEspnS2}
      onSwidChange={form.setSwid}
      swid={form.swid}
    /> : null}
    {discoveryError === null || privateAccessError?.code === "credentials_required"
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
