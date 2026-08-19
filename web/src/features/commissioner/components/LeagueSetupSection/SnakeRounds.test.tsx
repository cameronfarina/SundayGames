import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformFetch } from "../../../../shared/api/http/requestPlatformJson";
import { jsonResponse, requestBody, snakeSeason } from "../../test/commissionerFixtures";
import { SnakeRounds } from "./SnakeRounds";

const renderRounds = (fetcher: PlatformFetch, rounds = 16) => {
  vi.stubGlobal("fetch", vi.fn(fetcher));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    <SnakeRounds rosterSize={16} rounds={rounds} seasonId="season-1" />
  </QueryClientProvider>);
};

describe("SnakeRounds", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("saves a new round count and reports it back", async () => {
    const bodies: string[] = [];
    renderRounds((_input, init) => {
      bodies.push(requestBody(init));
      return Promise.resolve(jsonResponse({ season: snakeSeason }));
    });
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Draft rounds"));
    await user.type(screen.getByLabelText("Draft rounds"), "12");
    await user.click(screen.getByRole("button", { name: "Save rounds" }));

    expect(await screen.findByText("Draft rounds saved.")).toBeVisible();
    expect(bodies.at(-1)).toContain("\"rounds\":12");
  });

  it("blocks a count outside one to the roster size", async () => {
    renderRounds(vi.fn(() => Promise.resolve(jsonResponse({ season: snakeSeason }))));
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Draft rounds"));
    await user.type(screen.getByLabelText("Draft rounds"), "20");

    expect(screen.getByRole("alert")).toHaveTextContent("Use a whole number between 1 and 16.");
    expect(screen.getByRole("button", { name: "Save rounds" })).toBeDisabled();
  });

  it("keeps the button idle until the count actually changes", () => {
    renderRounds(vi.fn(() => Promise.resolve(jsonResponse({ season: snakeSeason }))));

    expect(screen.getByRole("button", { name: "Save rounds" })).toBeDisabled();
  });

  it("shows progress while the save is in flight", async () => {
    const pending = new Promise<Response>(() => undefined);
    renderRounds(() => pending);
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Draft rounds"));
    await user.type(screen.getByLabelText("Draft rounds"), "12");
    await user.click(screen.getByRole("button", { name: "Save rounds" }));

    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("shows the server's reason when the draft has already started", async () => {
    renderRounds(vi.fn(() => Promise.resolve(jsonResponse({
      error: {
        code: "draft_rounds_locked",
        message: "Draft rounds cannot change once the live draft has started.",
      },
    }, 409))));
    const user = userEvent.setup();

    await user.clear(screen.getByLabelText("Draft rounds"));
    await user.type(screen.getByLabelText("Draft rounds"), "8");
    await user.click(screen.getByRole("button", { name: "Save rounds" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("Draft rounds cannot change once the live draft has started.");
  });
});
