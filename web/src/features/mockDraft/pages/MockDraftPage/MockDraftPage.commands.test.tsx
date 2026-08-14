import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { auctionMockResponseFixture } from "../../test/auctionMockResponseFixture.js";
import { renderMockDraft } from "../../test/renderMockDraft.js";
import { awaitingNominationResponseFixture } from "../../test/sessionResponseFixtures.js";
import { MockDraftPage } from "./MockDraftPage.js";

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  headers: { "content-type": "application/json" },
  status,
});

describe("MockDraftPage commands", () => {
  it("passes and undoes from a resumed auction", async () => {
    const body = auctionMockResponseFixture();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(body));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Pass" }));
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
    await userEvent.click(screen.getByRole("button", { name: "Undo pick" }));
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(3); });
  });

  it("nominates from the player board", async () => {
    const body = awaitingNominationResponseFixture();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse(body));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Nominate Puka Nacua" }));
    await waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(2); });
  });

  it("shows a command error without discarding the active board", async () => {
    const body = auctionMockResponseFixture();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(body))
      .mockResolvedValueOnce(jsonResponse({
        error: { code: "stale_revision", message: "Reload the latest draft." },
      }, 409));
    renderMockDraft(
      <MockDraftPage fetcher={fetcher} initialSessionId="mock-1" seasonId="season-1" />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Pass" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Reload the latest draft.");
    expect(screen.getByRole("table", { name: "Available players" })).toBeInTheDocument();
  });
});
