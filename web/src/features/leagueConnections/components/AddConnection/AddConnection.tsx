import { InlineNotice } from "../../../../shared/ui";
import type { LeagueConnectionProviderInfo } from "../../api/leagueConnectionsSchema";
import { useAddConnectionForm } from "../../hooks/useAddConnectionForm";
import type { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { DiscoveredLeagueList } from "./DiscoveredLeagueList";
import { HandleForm } from "./HandleForm";
import { ProviderPicker } from "./ProviderPicker";
import "./AddConnection.css";

interface AddConnectionProps {
  readonly mutations: ReturnType<typeof useLeagueConnectionMutations>;
  readonly providers: readonly LeagueConnectionProviderInfo[];
}

export const AddConnection = ({ mutations, providers }: AddConnectionProps) => {
  const form = useAddConnectionForm(providers, mutations);
  const connectable = form.chosen?.availability === "connectable";
  // The cookie step already explains the private-league refusal in full, so
  // repeating the raw provider message underneath it would only add noise.
  const failure = form.showCookieStep
    ? mutations.connect.error
    : mutations.discover.error ?? mutations.connect.error;

  return <section aria-labelledby="add-connection-title" className="add-connection">
    <h2 id="add-connection-title">Connect a league</h2>
    <ProviderPicker
      onSelect={form.selectProvider}
      providers={providers}
      selected={form.provider}
    />
    {form.chosen !== undefined && connectable
      ? <HandleForm
        espnS2={form.espnS2}
        handle={form.handle}
        onEspnS2Change={form.setEspnS2}
        onHandleChange={form.setHandle}
        onSubmit={form.findLeagues}
        onSwidChange={form.setSwid}
        pending={mutations.discover.isPending || mutations.connect.isPending}
        provider={form.chosen}
        showCookieStep={form.showCookieStep}
        swid={form.swid}
      />
      : null}
    {failure === null ? null : <InlineNotice variant="error">{failure.message}</InlineNotice>}
    <DiscoveredLeagueList
      leagues={form.leagues}
      onConnect={form.connect}
      pending={mutations.connect.isPending}
    />
  </section>;
};
