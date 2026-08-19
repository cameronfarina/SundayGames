import { TextField } from "../../../../shared/ui";

interface CookieStepProps {
  readonly espnS2: string;
  readonly onEspnS2Change: (value: string) => void;
  readonly onSwidChange: (value: string) => void;
  readonly swid: string;
}

export const CookieStep = ({
  espnS2,
  onEspnS2Change,
  onSwidChange,
  swid,
}: CookieStepProps) => <div className="cookie-step">
  <h3>Connect your ESPN account</h3>
  <p>
    ESPN does not offer a "sign in with ESPN" button for fantasy imports. Paste two values your
    signed-in browser already holds and Sunday Games can find the leagues on that account.
  </p>
  <ol>
    <li>
      Open{" "}
      <a href="https://fantasy.espn.com" rel="noreferrer" target="_blank">fantasy.espn.com</a>
      {" "}in a new tab and sign in.
    </li>
    <li>Open your browser&apos;s developer tools, then go to Application, then Cookies.</li>
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
