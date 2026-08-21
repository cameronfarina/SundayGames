import { useState } from "react";
import { Button, TextField } from "../../../../shared/ui";

interface AccountCookieFormProps {
  readonly espnS2: string;
  readonly hasLeagueHandle: boolean;
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
  hasLeagueHandle,
  onEspnS2Change,
  onSubmit,
  onSwidChange,
  pending,
  swid,
}: AccountCookieFormProps) => {
  const [valuesVisible, setValuesVisible] = useState(false);
  const credentialType = valuesVisible ? "text" : "password";
  const credentialsComplete = espnS2.trim() !== "" && swid.trim() !== "";

  return <form
    className="add-connection__form cookie-step"
    onSubmit={event => { event.preventDefault(); onSubmit(); }}
  >
    <h3>Experimental private-league sync</h3>
    <p>
      <code>espn_s2</code> and <code>SWID</code> are account session credentials, not ordinary league
      IDs. Sunday Games masks them in your browser and stores them encrypted at rest. Anyone who
      obtains the original values may be able to use your ESPN session.
    </p>
    <p>
      ESPN expires these credentials. Private-league sync stops when they expire until you paste
      fresh values. Keep the private league link above, and use this fallback only when public
      viewability is not available.
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
      disabled={pending || !hasLeagueHandle || !credentialsComplete}
      type="submit"
    >
      {pending ? "Looking..." : "Find this private league"}
    </Button>
  </form>;
};
