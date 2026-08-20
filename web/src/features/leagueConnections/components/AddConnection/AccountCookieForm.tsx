import { useState } from "react";
import { Button, TextField } from "../../../../shared/ui";

interface AccountCookieFormProps {
  readonly espnS2: string;
  readonly onEspnS2Change: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onSwidChange: (value: string) => void;
  readonly pending: boolean;
  readonly swid: string;
}

/**
 * ESPN publishes no sign-in handoff, so the owner's own browser cookies are the
 * only key that exists. They are asked for up front rather than after a refusal,
 * because the same two values open every league on the account at once.
 */
export const AccountCookieForm = ({
  espnS2,
  onEspnS2Change,
  onSubmit,
  onSwidChange,
  pending,
  swid,
}: AccountCookieFormProps) => {
  const [valuesVisible, setValuesVisible] = useState(false);
  const credentialType = valuesVisible ? "text" : "password";

  return <form
    className="add-connection__form cookie-step"
    onSubmit={event => { event.preventDefault(); onSubmit(); }}
  >
  <h3>Find every league on your ESPN account</h3>
  <p>
    ESPN does not offer a "sign in with ESPN" button, so there is no way to hand you off to
    them. Instead you copy two values your browser already holds. It is a one-time step.
  </p>
  <ol>
    <li>
      Open{" "}
      <a href="https://fantasy.espn.com" rel="noreferrer" target="_blank">fantasy.espn.com</a>
      {" "}in a new tab and sign in.
    </li>
    <li>Open your browser's developer tools, then go to Application, then Cookies.</li>
    <li>Choose <code>https://fantasy.espn.com</code> in the list of sites.</li>
    <li>Copy the value of <code>espn_s2</code> and the value of <code>SWID</code>.</li>
    <li>Paste both below. Keep the curly braces around SWID.</li>
  </ol>
  <TextField
    autoComplete="off"
    id="connection-espn-s2"
    label="espn_s2 cookie"
    onChange={event => { onEspnS2Change(event.currentTarget.value); }}
    spellCheck={false}
    type={credentialType}
    value={espnS2}
  />
  <TextField
    autoComplete="off"
    hint="Looks like {AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}"
    id="connection-swid"
    label="SWID cookie"
    onChange={event => { onSwidChange(event.currentTarget.value); }}
    spellCheck={false}
    type={credentialType}
    value={swid}
  />
  <Button
    aria-pressed={valuesVisible}
    onClick={() => { setValuesVisible(current => !current); }}
    variant="secondary"
  >
    {valuesVisible ? "Hide ESPN cookie values" : "Show ESPN cookie values"}
  </Button>
  <Button disabled={pending || espnS2.trim() === "" || swid.trim() === ""} type="submit">
    {pending ? "Looking..." : "Find all my leagues"}
  </Button>
</form>;
};
