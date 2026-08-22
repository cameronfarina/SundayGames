import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  account,
  mountWizard,
  pathFor,
  providers,
  requestBody,
} from "../../../../test/SignupWizardTestUtils";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupWizard", () => {
  it("requires both research questions, omits Yahoo, and fast-tracks selected providers", async () => {
    const requests: { path: string; body?: unknown; method: string }[] = [];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathFor(input);
      const body = init?.body === undefined ? undefined : requestBody(init.body);
      requests.push({ path, body, method: init?.method ?? "GET" });
      if (path === "/league-connections") {
        return Promise.resolve(Response.json({ connections: [], providers }));
      }
      if (path === "/league-connections/discover") {
        return Promise.resolve(Response.json({
          error: {
            code: "credentials_required",
            message: "This ESPN league is private.",
          },
        }, { status: 422 }));
      }
      if (path === "/account-onboarding" && body?.["action"] === "set_intent") {
        return Promise.resolve(Response.json({
          onboarding: { intent: "practice", providers: null, stage: "providers" },
        }));
      }
      if (path === "/account-onboarding" && body?.["action"] === "set_providers") {
        return Promise.resolve(Response.json({
          onboarding: {
            intent: "practice",
            providers: ["espn", "sleeper", "other"],
            stage: "connections",
          },
        }));
      }
      return Promise.resolve(Response.json({
        onboarding: {
          intent: "practice",
          providers: ["espn", "sleeper", "other"],
          stage: "complete",
        },
      }));
    }));
    const user = userEvent.setup();
    mountWizard();

    expect(screen.getByText("Step 1 of 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Practice for a draft/u }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Step 2 of 3")).toHaveFocus();
    expect(screen.queryByText("Yahoo")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "ESPN" }));
    await user.click(screen.getByRole("checkbox", { name: "Sleeper" }));
    await user.click(screen.getByRole("checkbox", { name: "Other" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Step 3 of 3")).toHaveFocus();
    expect(screen.getByRole("heading", { name: "ESPN" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sleeper" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Other" })).toBeVisible();
    await user.type(
      screen.getByRole("textbox", { name: "ESPN league ID or league URL" }),
      "899513",
    );
    await user.click(screen.getByRole("button", { name: "Find this league" }));
    await user.click(screen.getByRole("button", { name: "I'm on mobile" }));
    expect(screen.getByText(/ESPN account connection requires a desktop browser/u)).toBeVisible();
    expect(screen.queryByLabelText("espn_s2 cookie")).not.toBeInTheDocument();
    const connectionRequests = requests.filter(request =>
      request.method === "POST" && request.path.startsWith("/league-connections")
    );
    expect(connectionRequests).toHaveLength(1);
    expect(connectionRequests[0]?.body).not.toHaveProperty("espnS2");
    expect(connectionRequests[0]?.body).not.toHaveProperty("swid");

    await user.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(requests.at(-1)?.body).toEqual({ accountId: account.id, action: "complete" });
  });

  it("resumes at the unanswered platform step and makes no-league exclusive", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(Response.json({ connections: [], providers }))));
    const user = userEvent.setup();
    mountWizard("providers");

    expect(screen.getByText("Step 2 of 3")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "ESPN" }));
    await user.click(screen.getByRole("checkbox", { name: "I don't have a league yet" }));

    expect(screen.getByRole("checkbox", { name: "ESPN" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "I don't have a league yet" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: /Practice for a draft/u })).toBeChecked();
  });

  it("keeps the selected answer visible when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(Response.json({
      error: { code: "onboarding_unavailable", message: "Setup is temporarily unavailable." },
    }, { status: 503 }))));
    const user = userEvent.setup();
    mountWizard();

    const practice = screen.getByRole("radio", { name: /Practice for a draft/u });
    await user.click(practice);
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Setup is temporarily unavailable.");
    expect(practice).toBeChecked();
  });
});
