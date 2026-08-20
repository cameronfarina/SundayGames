import { InlineNotice } from "../../../../shared/ui";
import type { LeagueConnection, LeagueConnectionProviderInfo } from "../../api/leagueConnectionsSchema";
import { useAddConnectionForm } from "../../hooks/useAddConnectionForm";
import type { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { AccountCookieForm } from "./AccountCookieForm";
import { DiscoveredLeagueList } from "./DiscoveredLeagueList";
import { HandleForm } from "./HandleForm";
import { ProviderPicker } from "./ProviderPicker";
import "./AddConnection.css";

interface AddConnectionProps {
  readonly connections: readonly LeagueConnection[];
  readonly mutations: ReturnType<typeof useLeagueConnectionMutations>;
  readonly providers: readonly LeagueConnectionProviderInfo[];
}

export const AddConnection = ({ connections, mutations, providers }: AddConnectionProps) => {
  const form = useAddConnectionForm(providers, mutations, connections);
  const provider = form.chosen;
  const searching = mutations.discover.isPending;
  // ESPN can list a whole account from two cookies, so the single-league form
  // steps aside and waits behind a disclosure for the people who still want it.
  const byAccount = provider?.supportsAccountDiscovery === true
    && provider.supportsCookieCredentials;
  const handleForm = provider === undefined ? null : <HandleForm
    handle={form.handle}
    onHandleChange={form.setHandle}
    onSubmit={form.findLeagues}
    pending={searching}
    provider={provider}
    submitLabel={byAccount ? "Find this league" : "Find my leagues"}
  />;

  return <section aria-labelledby="add-connection-title" className="add-connection">
    <h2 id="add-connection-title">Connect a league</h2>
    <ProviderPicker
      onSelect={form.selectProvider}
      providers={providers}
      selected={form.provider}
    />
    {provider?.availability !== "connectable" ? null : <>
      {byAccount ? <AccountCookieForm
        espnS2={form.espnS2}
        onEspnS2Change={form.setEspnS2}
        onSubmit={form.findAccountLeagues}
        onSwidChange={form.setSwid}
        pending={searching}
        swid={form.swid}
      /> : null}
      {byAccount
        ? <details className="add-connection__single">
          <summary>Only want one league? Connect it by ID</summary>
          {handleForm}
        </details>
        : handleForm}
    </>}
    {mutations.discover.error === null
      ? null
      : <InlineNotice variant="error">{mutations.discover.error.message}</InlineNotice>}
    <DiscoveredLeagueList
      leagues={form.leagues}
      onImport={form.importLeague}
      onImportAll={form.importAll}
      running={form.importing}
      states={form.leagueStates}
    />
  </section>;
};
