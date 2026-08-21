import { Button, TextField } from "../../../../shared/ui";
import type { LeagueConnectionProviderInfo } from "../../api/leagueConnectionsSchema";

interface HandleFormProps {
  readonly handle: string;
  readonly onHandleChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly pending: boolean;
  readonly provider: LeagueConnectionProviderInfo;
  readonly submitLabel: string;
  readonly inputId?: string;
}

export const HandleForm = ({
  handle,
  inputId = "connection-handle",
  onHandleChange,
  onSubmit,
  pending,
  provider,
  submitLabel,
}: HandleFormProps) => <form
  className="add-connection__form"
  onSubmit={event => { event.preventDefault(); onSubmit(); }}
>
  <TextField
    disabled={pending}
    hint={provider.handleHint}
    id={inputId}
    label={provider.handleLabel}
    onChange={event => { onHandleChange(event.currentTarget.value); }}
    value={handle}
  />
  <Button disabled={pending || handle.trim() === ""} type="submit">
    {pending ? "Looking..." : submitLabel}
  </Button>
</form>;
