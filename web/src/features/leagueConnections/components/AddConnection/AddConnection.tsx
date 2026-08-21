import type { LeagueConnection, LeagueConnectionProviderInfo } from "../../api/leagueConnectionsSchema";
import { useAddConnectionForm } from "../../hooks/useAddConnectionForm";
import type { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { ProviderConnectionSetup } from "../ProviderConnectionSetup/ProviderConnectionSetup";
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
  const connectableProvider = provider?.availability === "connectable" ? provider : undefined;

  return <section aria-labelledby="add-connection-title" className="add-connection">
    <h2 id="add-connection-title">Connect a league</h2>
    <ProviderPicker
      onSelect={form.selectProvider}
      providers={providers}
      selected={form.provider}
    />
    {connectableProvider === undefined ? null : <ProviderConnectionSetup
      connections={connections}
      key={connectableProvider.provider}
      mutations={mutations}
      provider={connectableProvider}
    />}
  </section>;
};
