import { useState } from "react";
import { Button, TextField } from "../../../../shared/ui";

interface AccountCookieFormProps {
  readonly espnS2: string;
  readonly headingLevel?: 3 | 4 | 5;
  readonly onEspnS2Change: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onSwidChange: (value: string) => void;
  readonly pending: boolean;
  readonly swid: string;
}

export const AccountCookieForm = ({
  espnS2,
  headingLevel = 3,
  onEspnS2Change,
  onSubmit,
  onSwidChange,
  pending,
  swid,
}: AccountCookieFormProps) => {
  const [valuesVisible, setValuesVisible] = useState(false);
  const Heading = headingLevel === 5 ? "h5" : headingLevel === 4 ? "h4" : "h3";
  const credentialType = valuesVisible ? "text" : "password";
  const credentialsComplete = espnS2.trim() !== "" && swid.trim() !== "";

  return <form
    className="add-connection__form cookie-step"
    onSubmit={event => { event.preventDefault(); onSubmit(); }}
  >
    <Heading>Use ESPN cookies</Heading>
    <p>Paste 2 ESPN cookies to find every fantasy football league on your ESPN account.</p>
    <ol>
      <li>
        Open{" "}
        <a href="https://fantasy.espn.com" rel="noreferrer" target="_blank">fantasy.espn.com</a>
        {" "}in a new tab and sign in.
      </li>
      <li>
        Open developer tools (<strong>Cmd + Option + I</strong> on Mac or
        {" "}<strong>Ctrl + Shift + I</strong> on Windows).
      </li>
      <li>
        Open Application, then Cookies, then <code>https://fantasy.espn.com</code>.
      </li>
      <li>
        Copy <code>espn_s2</code> and <code>SWID</code>, then paste both below. Keep the curly braces
        around SWID.
      </li>
    </ol>
    <TextField
      autoComplete="off"
      disabled={pending}
      id="connection-espn-s2"
      label="espn_s2 cookie"
      onChange={event => { onEspnS2Change(event.currentTarget.value); }}
      spellCheck={false}
      type={credentialType}
      value={espnS2}
    />
    <TextField
      autoComplete="off"
      disabled={pending}
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
      disabled={pending}
      onClick={() => { setValuesVisible(current => !current); }}
      variant="secondary"
    >
      {valuesVisible ? "Hide ESPN cookie values" : "Show ESPN cookie values"}
    </Button>
    <Button
      disabled={pending || !credentialsComplete}
      type="submit"
    >
      {pending ? "Looking..." : "Find my ESPN leagues"}
    </Button>
  </form>;
};
