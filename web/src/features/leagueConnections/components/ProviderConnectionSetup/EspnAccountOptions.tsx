import { Button, InlineNotice } from "../../../../shared/ui";
import type { ConnectionCredentials } from "../../api/leagueConnectionsApi";
import { AccountCookieForm } from "../AddConnection/AccountCookieForm";
import { EspnBrowserExtensionOption } from "./EspnBrowserExtensionOption";

interface EspnAccountOptionsProps {
  readonly disabled: boolean;
  readonly espnMobileDeferred: boolean;
  readonly espnS2: string;
  readonly headingLevel: 3 | 4;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onCredentials: (credentials?: ConnectionCredentials) => void;
  readonly onEspnMobile: (() => void) | undefined;
  readonly onEspnS2Change: (value: string) => void;
  readonly onSwidChange: (value: string) => void;
  readonly swid: string;
}

export const EspnAccountOptions = ({
  disabled,
  espnMobileDeferred,
  espnS2,
  headingLevel,
  onBusyChange,
  onCredentials,
  onEspnMobile,
  onEspnS2Change,
  onSwidChange,
  swid,
}: EspnAccountOptionsProps) => {
  const Heading = headingLevel === 4 ? "h4" : "h3";
  const optionHeadingLevel = headingLevel === 4 ? 5 : 4;

  return <section className="espn-account-options">
    <Heading>Find every ESPN league</Heading>
    <p>
      Use your ESPN session to find every current-season fantasy football league on your account.
      No league ID is required.
    </p>
    {onEspnMobile === undefined || espnMobileDeferred ? null : <Button
      disabled={disabled}
      onClick={onEspnMobile}
      variant="secondary"
    >
      I'm on mobile
    </Button>}
    {espnMobileDeferred ? <InlineNotice title="Connect it later" variant="info">
      ESPN account connection requires a desktop browser. Finish setup now, then connect your
      leagues from Connections.
    </InlineNotice> : <>
      <EspnBrowserExtensionOption
        disabled={disabled}
        headingLevel={optionHeadingLevel}
        onBusyChange={onBusyChange}
        onCredentials={onCredentials}
      />
      <AccountCookieForm
        espnS2={espnS2}
        headingLevel={optionHeadingLevel}
        onEspnS2Change={onEspnS2Change}
        onSubmit={onCredentials}
        onSwidChange={onSwidChange}
        pending={disabled}
        swid={swid}
      />
    </>}
  </section>;
};
