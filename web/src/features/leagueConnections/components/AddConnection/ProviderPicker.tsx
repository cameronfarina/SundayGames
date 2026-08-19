import { InlineNotice } from "../../../../shared/ui";
import type {
  LeagueConnectionProvider,
  LeagueConnectionProviderInfo,
} from "../../api/leagueConnectionsSchema";

interface ProviderPickerProps {
  readonly onSelect: (provider: LeagueConnectionProvider) => void;
  readonly providers: readonly LeagueConnectionProviderInfo[];
  readonly selected: LeagueConnectionProvider | undefined;
}

export const ProviderPicker = ({ onSelect, providers, selected }: ProviderPickerProps) => {
  const chosen = providers.find(provider => provider.provider === selected);

  return <div className="add-connection__providers">
    <div aria-label="Fantasy providers" className="add-connection__tabs" role="tablist">
      {providers.map(provider => <button
        aria-selected={provider.provider === selected}
        key={provider.provider}
        onClick={() => { onSelect(provider.provider); }}
        role="tab"
        type="button"
      >{provider.label}</button>)}
    </div>
    {chosen === undefined ? null : <InlineNotice
      variant={chosen.availability === "connectable" ? "info" : "warning"}
    >{chosen.detail}</InlineNotice>}
  </div>;
};
