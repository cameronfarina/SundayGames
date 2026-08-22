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

const renderOption = (headingLevel: 4 | 5 = 4, disabled = false) => {
  const onBusyChange = vi.fn();
  const onCredentials = vi.fn();
  const { unmount } = render(<EspnBrowserExtensionOption
    disabled={disabled}
    headingLevel={headingLevel}
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

  it("does not update after detection finishes on a closed screen", async () => {
    let finishDetection: (detected: boolean) => void = () => {
      throw new Error("Detection resolver was not installed.");
    };
    vi.mocked(detectEspnBrowserExtension).mockImplementation(() => new Promise(resolve => {
      finishDetection = resolve;
    }));
    const { unmount } = renderOption();

    unmount();
    finishDetection(true);
    await Promise.resolve();

    expect(screen.queryByRole("button", { name: "Connect with browser extension" }))
      .not.toBeInTheDocument();
  });

  it("uses the requested heading level and respects a parent lock", async () => {
    renderOption(5, true);

    expect(await screen.findByRole("heading", { level: 5, name: "Connect automatically" }))
      .toBeVisible();
    expect(screen.getByRole("button", { name: "Connect with browser extension" })).toBeDisabled();
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

  it.each([
    {
      error: new EspnBrowserExtensionError("extension_unavailable"),
      message: "The browser extension stopped responding. Reload this page or paste the cookies manually.",
    },
    {
      error: new EspnBrowserExtensionError("read_failed"),
      message: "The browser extension could not read your ESPN session. Try again or paste the cookies manually.",
    },
    {
      error: new Error("unexpected"),
      message: "The browser extension could not read your ESPN session. Try again or paste the cookies manually.",
    },
  ])("shows the safe fallback for $error", async ({ error, message }) => {
    vi.mocked(requestEspnBrowserCredentials).mockRejectedValue(error);
    const user = userEvent.setup();
    renderOption();

    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("aborts an in-flight credential read when the connection screen closes", async () => {
    let requestSignal: AbortSignal | undefined;
    vi.mocked(requestEspnBrowserCredentials).mockImplementation(signal => {
      requestSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => { reject(new Error("aborted")); }, { once: true });
      });
    });
    const user = userEvent.setup();
    const { onBusyChange, onCredentials, unmount } = renderOption();

    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));
    unmount();

    expect(requestSignal?.aborted).toBe(true);
    expect(onCredentials).not.toHaveBeenCalled();
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });

  it("ignores credentials that finish after the connection screen closes", async () => {
    let finishRequest: (credentials: { readonly espnS2: string; readonly swid: string }) => void
      = () => { throw new Error("Credential resolver was not installed."); };
    vi.mocked(requestEspnBrowserCredentials).mockImplementation(() => new Promise(resolve => {
      finishRequest = resolve;
    }));
    const user = userEvent.setup();
    const { onBusyChange, onCredentials, unmount } = renderOption();

    await user.click(await screen.findByRole("button", { name: "Connect with browser extension" }));
    unmount();
    finishRequest({ espnS2: "late-s2", swid: "{LATE}" });
    await Promise.resolve();

    expect(onCredentials).not.toHaveBeenCalled();
    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
  });
});
