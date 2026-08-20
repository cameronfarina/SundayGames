import { InlineNotice } from "../../../../shared/ui";
import type {
  LeagueConnection,
  LeagueConnectionProviderInfo,
} from "../../api/leagueConnectionsSchema";
import { useAddConnectionForm } from "../../hooks/useAddConnectionForm";
import type { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import {
  DiscoveredLeagueList,
  type LeagueImportTarget,
} from "./DiscoveredLeagueList";
import { HandleForm } from "./HandleForm";
import { ProviderPicker } from "./ProviderPicker";
import "./AddConnection.css";

interface AddConnectionProps {
  readonly connections: readonly LeagueConnection[];
  readonly mutations: ReturnType<typeof useLeagueConnectionMutations>;
  readonly providers: readonly LeagueConnectionProviderInfo[];
  readonly targets: readonly LeagueImportTarget[];
}

export const AddConnection = ({
  connections,
  mutations,
  providers,
  targets,
}: AddConnectionProps) => {
  const form = useAddConnectionForm(providers, mutations, connections);
  const connectable = form.chosen?.availability === "connectable";
  const failure = mutations.discover.error ?? mutations.connect.error;

  return <section aria-labelledby="add-connection-title" className="add-connection">
    <h2 id="add-connection-title">Import leagues</h2>
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
        pending={mutations.discover.isPending || form.connecting}
        provider={form.chosen}
        showCookieStep={form.showCookieStep}
        swid={form.swid}
      />
      : null}
    {failure === null ? null : <InlineNotice variant="error">{failure.message}</InlineNotice>}
    <DiscoveredLeagueList
      leagues={form.leagues}
      onConnect={form.connect}
      onConnectAll={form.connectAll}
      onTargetChange={form.setTarget}
      pending={form.connecting}
      states={form.leagueStates}
      targetSeasonIds={form.targetSeasonIds}
      targets={targets}
    />
  </section>;
};
