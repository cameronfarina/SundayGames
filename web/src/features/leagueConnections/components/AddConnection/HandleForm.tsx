import { Button, TextField } from "../../../../shared/ui";
import type { LeagueConnectionProviderInfo } from "../../api/leagueConnectionsSchema";
import { CookieStep } from "./CookieStep";

interface HandleFormProps {
  readonly espnS2: string;
  readonly handle: string;
  readonly onEspnS2Change: (value: string) => void;
  readonly onHandleChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onSwidChange: (value: string) => void;
  readonly pending: boolean;
  readonly provider: LeagueConnectionProviderInfo;
  readonly showCookieStep: boolean;
  readonly swid: string;
}

const submitLabel = (pending: boolean, showCookieStep: boolean): string => {
  if (pending) return "Connecting...";
  return showCookieStep ? "Try again with these cookies" : "Connect league";
};

export const HandleForm = ({
  espnS2,
  handle,
  onEspnS2Change,
  onHandleChange,
  onSubmit,
  onSwidChange,
  pending,
  provider,
  showCookieStep,
  swid,
}: HandleFormProps) => <form
  className="add-connection__form"
  onSubmit={event => { event.preventDefault(); onSubmit(); }}
>
  <TextField
    hint={provider.handleHint}
    id="connection-handle"
    label={provider.handleLabel}
    onChange={event => { onHandleChange(event.currentTarget.value); }}
    value={handle}
  />
  {showCookieStep
    ? <CookieStep
      espnS2={espnS2}
      onEspnS2Change={onEspnS2Change}
      onSwidChange={onSwidChange}
      swid={swid}
    />
    : null}
  <Button disabled={pending || handle.trim() === ""} type="submit">
    {provider.handleNamesOneLeague ? submitLabel(pending, showCookieStep) : "Find my leagues"}
  </Button>
</form>;
