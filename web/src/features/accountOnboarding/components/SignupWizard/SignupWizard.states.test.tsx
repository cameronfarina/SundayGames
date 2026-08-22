import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../../auth/api/sessionQuery";
import {
  account,
  mountWizard,
  pathFor,
  providers,
  requestBody,
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

describe("SignupWizard states", () => {
  it("supports revising each persisted answer before setup is finished", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body === undefined ? undefined : requestBody(init.body);
      if (pathFor(input) === "/league-connections") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      return Promise.resolve(Response.json({
        onboarding: {
          intent: body?.["intent"] ?? "practice",
          providers: ["espn", "sleeper", "other"],
          stage: "connections",
        },
      }));
    }));
    const user = userEvent.setup();
    mountWizard("connections");

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("checkbox", { name: "ESPN" }));
    expect(screen.getByRole("checkbox", { name: "ESPN" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "I don't have a league yet" }));
    await user.click(screen.getByRole("checkbox", { name: "I don't have a league yet" }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("radio", { name: /Host a live draft/u }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Step 2 of 3")).toBeVisible();
  });

  it("lets a user with no league finish without loading connection tools", async () => {
    const pending = deferredResponse();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const user = userEvent.setup();
    mountWizard("providers");

    await user.click(screen.getByRole("checkbox", { name: "I don't have a league yet" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    pending.resolve(Response.json({
      onboarding: { intent: "practice", providers: ["none"], stage: "connections" },
    }));

    expect(await screen.findByText(/create one after setup or explore practice drafts/u)).toBeVisible();
    expect(screen.queryByText("Loading connection options...")).not.toBeInTheDocument();
  });

  it("keeps provider loading and availability failures optional", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({
        connections: [],
        providers: [{ ...providers[1], availability: "unavailable", detail: "ESPN is paused." }],
      })));
    mountWizard("connections");

    expect(await screen.findByText("ESPN is paused.")).toBeVisible();
    expect(screen.getByText("Sleeper sync is not available right now.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish setup" })).toBeEnabled();
  });

  it("shows a retryable connection-options error without blocking finish", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({
      error: { code: "connections_unavailable", message: "Connections are unavailable." },
    }, { status: 503 }))));
    mountWizard("connections");

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/u);
    expect(screen.getByRole("button", { name: "Finish setup" })).toBeEnabled();
  });

  it("names ESPN when its provider configuration is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({
      connections: [], providers: [providers[0]],
    }))));
    mountWizard("connections");

    expect(await screen.findByText("ESPN sync is not available right now.")).toBeVisible();
  });

  it("does not install a stale onboarding response after the cached account changes", async () => {
    const pending = deferredResponse();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const user = userEvent.setup();
    const client = mountWizard();

    await user.click(screen.getByRole("radio", { name: /Practice for a draft/u }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const replacement = { ...account, email: "other@example.com", id: "account-other" };
    act(() => { client.setQueryData(sessionQueryKey(), { account: replacement }); });
    pending.resolve(Response.json({
      onboarding: { intent: "practice", providers: null, stage: "providers" },
    }));

    await waitFor(() => {
      expect(client.getQueryData(sessionQueryKey())).toEqual({ account: replacement });
    });
  });

  it("clears typed ESPN credentials when the cached account changes", async () => {
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (pathFor(input) === "/league-connections/discover") {
        return Promise.resolve(Response.json({
          error: { code: "credentials_required", message: "This ESPN league is private." },
        }, { status: 422 }));
      }
      return Promise.resolve(Response.json({ connections: [], providers }));
    }));
    const user = userEvent.setup();
    const client = mountWizard("connections");
    await screen.findByRole("heading", { name: "ESPN" });
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "899513",
    );
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    await screen.findByRole("heading", { name: "Use ESPN cookies" });
    await user.type(screen.getByLabelText("espn_s2 cookie"), "account-a-secret");

    act(() => {
      client.setQueryData(sessionQueryKey(), {
        account: { ...account, email: "other@example.com", id: "account-other" },
        onboarding: {
          intent: "practice",
          providers: ["espn", "sleeper", "other"],
          stage: "connections",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "ESPN league ID or league URL" })).toHaveValue("");
    });
    expect(screen.queryByLabelText("espn_s2 cookie")).not.toBeInTheDocument();
  });
});
