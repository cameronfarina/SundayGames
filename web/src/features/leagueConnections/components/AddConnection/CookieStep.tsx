import { TextField } from "../../../../shared/ui";

interface CookieStepProps {
  readonly espnS2: string;
  readonly onEspnS2Change: (value: string) => void;
  readonly onSwidChange: (value: string) => void;
  readonly swid: string;
}

/**
 * Only shown after ESPN has actually refused the league. ESPN publishes no
 * sign-in handoff, so the owner's own browser cookies are the only key that
 * exists — the copy says so rather than leaving them to wonder.
 */
export const CookieStep = ({
  espnS2,
  onEspnS2Change,
  onSwidChange,
  swid,
}: CookieStepProps) => <div className="cookie-step">
  <h3>This league is private</h3>
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
    id="connection-espn-s2"
    label="espn_s2 cookie"
    onChange={event => { onEspnS2Change(event.currentTarget.value); }}
    value={espnS2}
  />
  <TextField
    hint="Looks like {AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}"
    id="connection-swid"
    label="SWID cookie"
    onChange={event => { onSwidChange(event.currentTarget.value); }}
    value={swid}
  />
</div>;
