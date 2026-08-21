import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../../auth/api/sessionQuery";
import {
  account,
  mountWizard,
  mountWizardWithoutSession,
  pathFor,
  providers,
} from "../../../../test/SignupWizardTestUtils";

const deferredResponse = () => {
  let resolveResponse: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>(resolve => { resolveResponse = resolve; });
  return {
    promise,
    resolve(response: Response) {
      if (resolveResponse === undefined) throw new Error("Response resolver was not initialized.");
      resolveResponse(response);
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupWizard completion", () => {
  it("keeps the wizard open and actionable when finishing fails", async () => {
    const pendingFinish = deferredResponse();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (pathFor(input) === "/league-connections") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      return pendingFinish.promise;
    }));
    const user = userEvent.setup();
    mountWizard("connections");
    await screen.findByRole("heading", { name: "ESPN" });

    await user.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(screen.getByRole("button", { name: "Finishing..." })).toBeDisabled();
    pendingFinish.resolve(Response.json({
      error: { code: "onboarding_unavailable", message: "Setup is temporarily unavailable." },
    }, { status: 503 }));

    const actions = screen.getByRole("group", { name: "Setup actions" });
    expect(await within(actions).findByRole("alert"))
      .toHaveTextContent("Setup is temporarily unavailable.");
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("closes as soon as the cached onboarding state is complete", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({
      connections: [], providers,
    }))));
    const client = mountWizard();

    act(() => {
      client.setQueryData(sessionQueryKey(), {
        account,
        onboarding: { intent: "practice", providers: ["none"], stage: "complete" },
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("announces connection options while they load", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    mountWizard("connections");

    expect(screen.getByRole("status")).toHaveTextContent("Loading connection options...");
  });

  it("does not render before the authenticated session is available", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    mountWizardWithoutSession();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tolerates a malformed connection stage with no provider answers", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({
      connections: [], providers,
    }))));
    mountWizard("connections", null);

    expect(screen.getByRole("button", { name: "Finish setup" })).toBeEnabled();
    expect(screen.queryByText("Loading connection options...")).not.toBeInTheDocument();
  });
});
