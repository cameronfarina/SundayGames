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

const submitLabel = (pending: boolean, oneLeague: boolean): string => {
  if (pending) return "Connecting...";
  return oneLeague ? "Connect league" : "Find my leagues";
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
}: HandleFormProps) => {
  const accountReady = provider.provider === "espn"
    && espnS2.trim().length > 0
    && swid.trim().length > 0;
  const canSubmit = handle.trim().length > 0 || accountReady;

  return <form
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
    <Button disabled={pending || !canSubmit} type="submit">
      {submitLabel(pending, provider.handleNamesOneLeague)}
    </Button>
  </form>;
};
