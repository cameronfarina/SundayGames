import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectEspnBrowserExtension,
  EspnBrowserExtensionError,
  requestEspnBrowserCredentials,
} from "../../api/espnBrowserExtensionApi";
import { EspnBrowserExtensionOption } from "./EspnBrowserExtensionOption";

vi.mock("../../api/espnBrowserExtensionApi", () => ({
  detectEspnBrowserExtension: vi.fn(),
  EspnBrowserExtensionError: class extends Error {
    public readonly code: "extension_unavailable" | "not_signed_in" | "read_failed";

    public constructor(code: "extension_unavailable" | "not_signed_in" | "read_failed") {
      super(code);
      this.code = code;
    }
  },
  requestEspnBrowserCredentials: vi.fn(),
}));

const renderOption = () => {
  const onBusyChange = vi.fn();
  const onCredentials = vi.fn();
  const { unmount } = render(<EspnBrowserExtensionOption
    disabled={false}
    headingLevel={4}
    onBusyChange={onBusyChange}
    onCredentials={onCredentials}
  />);
  return { onBusyChange, onCredentials, unmount };
};

describe("EspnBrowserExtensionOption", () => {
  beforeEach(() => {
    vi.mocked(detectEspnBrowserExtension).mockResolvedValue(true);
    vi.mocked(requestEspnBrowserCredentials).mockResolvedValue({
      espnS2: "extension-s2",
      swid: "{EXTENSION}",
    });
  });

  it("appears only when the extension answers", async () => {
    vi.mocked(detectEspnBrowserExtension).mockResolvedValue(false);
    renderOption();

    await waitFor(() => { expect(detectEspnBrowserExtension).toHaveBeenCalledOnce(); });
    expect(screen.queryByRole("button", { name: "Connect with browser extension" }))
      .not.toBeInTheDocument();
  });

  it("hands the extension credentials to the scoped ESPN lookup", async () => {
    const user = userEvent.setup();
    const { onBusyChange, onCredentials } = renderOption();

    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));

    await waitFor(() => {
      expect(onCredentials).toHaveBeenCalledWith({
        espnS2: "extension-s2",
        swid: "{EXTENSION}",
      });
    });
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it("explains when ESPN is not signed in and releases the busy state", async () => {
    vi.mocked(requestEspnBrowserCredentials)
      .mockRejectedValue(new EspnBrowserExtensionError("not_signed_in"));
    const user = userEvent.setup();
    const { onBusyChange, onCredentials } = renderOption();

    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Sign in to ESPN in this browser, then try again.");
    expect(onCredentials).not.toHaveBeenCalled();
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it("aborts an in-flight credential read when the connection screen closes", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.mocked(requestEspnBrowserCredentials).mockImplementation(signal => {
      requestSignal = signal;
      return new Promise(() => undefined);
    });
    const user = userEvent.setup();
    const { onBusyChange, onCredentials, unmount } = renderOption();

    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));
    unmount();

    expect(requestSignal?.aborted).toBe(true);
    expect(onCredentials).not.toHaveBeenCalled();
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });
});
