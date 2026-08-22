import { useEffect, useRef, useState } from "react";
import type { ConnectionCredentials } from "../../api/leagueConnectionsApi";
import {
  detectEspnBrowserExtension,
  EspnBrowserExtensionError,
  requestEspnBrowserCredentials,
} from "../../api/espnBrowserExtensionApi";
import { Button, InlineNotice } from "../../../../shared/ui";

interface EspnBrowserExtensionOptionProps {
  readonly disabled: boolean;
  readonly headingLevel: 4 | 5;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onCredentials: (credentials: ConnectionCredentials) => void;
}

const extensionErrorMessage = (error: unknown): string => {
  if (error instanceof EspnBrowserExtensionError && error.code === "not_signed_in") {
    return "Sign in to ESPN in this browser, then try again.";
  }
  if (error instanceof EspnBrowserExtensionError && error.code === "extension_unavailable") {
    return "The browser extension stopped responding. Reload this page or paste the cookies manually.";
  }
  return "The browser extension could not read your ESPN session. Try again or paste the cookies manually.";
};

export const EspnBrowserExtensionOption = ({
  disabled,
  headingLevel,
  onBusyChange,
  onCredentials,
}: EspnBrowserExtensionOptionProps) => {
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const Heading = headingLevel === 5 ? "h5" : "h4";
  useEffect(() => {
    let active = true;
    void detectEspnBrowserExtension().then(detected => {
      if (active) setAvailable(detected);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
      onBusyChange(false);
    };
  }, [onBusyChange]);
  if (!available) return null;
  const connect = async (): Promise<void> => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setError(null);
    setReading(true);
    onBusyChange(true);
    try {
      const credentials = await requestEspnBrowserCredentials(controller.signal);
      if (!controller.signal.aborted && mounted.current) onCredentials(credentials);
    } catch (nextError) {
      if (!controller.signal.aborted && mounted.current) setError(extensionErrorMessage(nextError));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        if (mounted.current) {
          onBusyChange(false);
          setReading(false);
        }
      }
    }
  };

  return <section className="espn-extension-option">
    <Heading>Connect automatically</Heading>
    <p>
      The Sunday Games browser extension reads only your <code>espn_s2</code> and <code>SWID</code>
      {" "}cookies. These are ESPN account session credentials that Sunday Games stores encrypted,
      and they expire when ESPN ends the session. The extension never sees your ESPN password.
    </p>
    <Button disabled={disabled || reading} onClick={() => { void connect(); }}>
      {reading ? "Connecting..." : "Connect with browser extension"}
    </Button>
    {error === null ? null : <InlineNotice variant="error">{error}</InlineNotice>}
  </section>;
};
