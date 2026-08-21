import { Button, InlineNotice } from "../../../../shared/ui";
import { useEffect } from "react";
import type { LeagueConnection, LeagueConnectionProviderInfo } from "../../api/leagueConnectionsSchema";
import { useAddConnectionForm } from "../../hooks/useAddConnectionForm";
import type { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { AccountCookieForm } from "../AddConnection/AccountCookieForm";
import { DiscoveredLeagueList } from "../AddConnection/DiscoveredLeagueList";
import { HandleForm } from "../AddConnection/HandleForm";
import "../AddConnection/AddConnection.css";
import "./ProviderConnectionSetup.css";

interface ProviderConnectionSetupProps {
  readonly connections: readonly LeagueConnection[];
  readonly disabled?: boolean;
  readonly espnMobileDeferred?: boolean;
  readonly mutations: ReturnType<typeof useLeagueConnectionMutations>;
  readonly onBusyChange?: (provider: string, busy: boolean) => void;
  readonly onEspnMobile?: () => void;
  readonly provider: LeagueConnectionProviderInfo;
}

export const ProviderConnectionSetup = ({
  connections,
  disabled = false,
  espnMobileDeferred = false,
  mutations,
  onBusyChange,
  onEspnMobile,
  provider,
}: ProviderConnectionSetupProps) => {
  const form = useAddConnectionForm(
    [provider],
    mutations,
    connections,
    provider.provider,
  );
  const localBusy = mutations.discover.isPending || form.importing;
  const busy = disabled || localBusy;
  useEffect(() => {
    onBusyChange?.(provider.provider, localBusy);
    return () => { onBusyChange?.(provider.provider, false); };
  }, [localBusy, onBusyChange, provider.provider]);
  if (provider.availability !== "connectable") {
    return <InlineNotice variant="warning">{provider.detail}</InlineNotice>;
  }
  const espn = provider.provider === "espn";
  const handleForm = <HandleForm
    handle={form.handle}
    inputId={`connection-handle-${provider.provider}`}
    onHandleChange={form.setHandle}
    onSubmit={form.findLeagues}
    pending={busy}
    provider={provider}
    submitLabel={espn ? "Find this league" : "Find my leagues"}
  />;

  return <div className="provider-connection-setup">
    {espn ? <div className="espn-public-step">
      <h4>Paste a publicly viewable league link</h4>
      <p>
        This lets Sunday Games read league settings, teams, rosters, and matchups. People with the
        link can view league pages, but they cannot join or change your league.
      </p>
      <details>
        <summary>How to enable public viewability in ESPN</summary>
        <ol aria-label="Make this ESPN league publicly viewable">
          <li>Open the league on ESPN's website and select League.</li>
          <li>Select Settings, then Basic Settings.</li>
          <li>Select Edit Basic Settings.</li>
          <li>Set Public viewability to Yes.</li>
          <li>Select Save Changes.</li>
        </ol>
        <p>
          Only the commissioner of a League Manager league can change this setting. Public
          viewability does not let anyone join. Manager lists and message boards remain private. {" "}
          <a
            href="https://support.espn.com/hc/en-us/articles/360000088231-Making-a-Private-League-Viewable-to-the-Public-LM-Only"
            rel="noreferrer"
            target="_blank"
          >Read ESPN's instructions.</a>
        </p>
      </details>
      {handleForm}
    </div> : <>
      <p className="provider-connection-setup__intro">
        Enter your Sleeper username to find your 2026 leagues. No password is required.
      </p>
      {handleForm}
    </>}
    {espn ? <details className="add-connection__fallback">
      <summary>Experimental: connect a private ESPN league</summary>
      {onEspnMobile === undefined || espnMobileDeferred ? null : <Button
        disabled={busy}
        onClick={onEspnMobile}
        variant="secondary"
      >
        I'm on mobile
      </Button>}
      {espnMobileDeferred ? <InlineNotice title="Connect your private ESPN league later" variant="info">
        You can connect a publicly viewable ESPN league from this phone using its link above.
        Private ESPN leagues require desktop browser tools. We've saved ESPN as one of your
        platforms, so you can finish setup now and connect it later.
      </InlineNotice> : <AccountCookieForm
        espnS2={form.espnS2}
        hasLeagueHandle={form.handle.trim() !== ""}
        onEspnS2Change={form.setEspnS2}
        onSubmit={form.findLeaguesWithCredentials}
        onSwidChange={form.setSwid}
        pending={busy}
        swid={form.swid}
      />}
    </details> : null}
    {mutations.discover.error === null
      ? null
      : <InlineNotice variant="error">{mutations.discover.error.message}</InlineNotice>}
    <DiscoveredLeagueList
      leagues={form.leagues}
      onImport={form.importLeague}
      onImportAll={form.importAll}
      running={busy}
      states={form.leagueStates}
    />
  </div>;
};
