import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auctionSeason, jsonResponse, requestBody } from "../../test/commissionerFixtures";
import { TeamListPaste } from "./TeamListPaste";

const readyImport = { status: "ready", blockers: [], records: [] };

const capturePasteBodies = (respond: () => Promise<Response>) => {
  const bodies: string[] = [];
  vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(requestBody(init));
    return respond();
  }));
  render(<QueryClientProvider client={new QueryClient()}>
    <TeamListPaste seasonId="season-1" />
  </QueryClientProvider>);
  return bodies;
};

const savedResponse = () => Promise.resolve(jsonResponse({
  season: auctionSeason, import: readyImport, invitations: [], invitationFailures: [],
}));

const openPasteBox = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByText("Paste a full team list"));
};

describe("TeamListPaste", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("stays closed until the commissioner asks for it", () => {
    capturePasteBodies(savedResponse);

    expect(screen.getByLabelText("Teams and managers")).not.toBeVisible();
  });

  it("keeps the replace action disabled until rows are pasted", async () => {
    capturePasteBodies(savedResponse);
    const user = userEvent.setup();
    await openPasteBox(user);

    const replace = screen.getByRole("button", { name: "Replace team list" });
    expect(replace).toBeDisabled();
    await user.type(screen.getByLabelText("Teams and managers"), "owner,team");
    expect(replace).toBeEnabled();
  });

  it("sends the pasted rows exactly as typed", async () => {
    const bodies = capturePasteBodies(savedResponse);
    const user = userEvent.setup();
    await openPasteBox(user);

    await user.type(screen.getByLabelText("Teams and managers"), "owner,team,email,role");
    await user.click(screen.getByRole("button", { name: "Replace team list" }));

    expect(await screen.findByText("League teams saved.")).toBeVisible();
    expect(bodies.at(-1)).toContain("owner,team,email,role");
  });

  it("labels the replace action while the request is pending", async () => {
    capturePasteBodies(() => new Promise<Response>(() => undefined));
    const user = userEvent.setup();
    await openPasteBox(user);

    await user.type(screen.getByLabelText("Teams and managers"), "owner,team");
    await user.click(screen.getByRole("button", { name: "Replace team list" }));

    expect(screen.getByRole("button", { name: "Replacing..." })).toBeDisabled();
  });

  it("reports a paste failure that carries no row blockers", async () => {
    capturePasteBodies(() => Promise.resolve(jsonResponse({
      error: { code: "setup_failed", message: "Could not apply." },
    }, 422)));
    const user = userEvent.setup();
    await openPasteBox(user);

    await user.type(screen.getByLabelText("Teams and managers"), "x");
    await user.click(screen.getByRole("button", { name: "Replace team list" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not apply.");
  });

  it("names the team a rejected paste would have deleted", async () => {
    capturePasteBodies(() => Promise.resolve(jsonResponse({
      error: {
        code: "league_setup_deletes_teams",
        message: "These rows would delete a team and everything saved against it, including keepers: Ty (Short King). Every team must appear exactly once.",
      },
    }, 409)));
    const user = userEvent.setup();
    await openPasteBox(user);

    await user.type(screen.getByLabelText("Teams and managers"), "x");
    await user.click(screen.getByRole("button", { name: "Replace team list" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ty (Short King)");
  });

  it("reports the blockers from a rejected paste", async () => {
    capturePasteBodies(() => Promise.resolve(jsonResponse({
      error: { code: "league_setup_import_blocked", message: "Resolve league setup import blockers before applying." },
      import: { status: "blocked", records: [], blockers: [{ code: "blank_owner", message: "Owner is required." }] },
    }, 400)));
    const user = userEvent.setup();
    await openPasteBox(user);

    await user.type(screen.getByLabelText("Teams and managers"), "x");
    await user.click(screen.getByRole("button", { name: "Replace team list" }));

    expect(await screen.findByText("Owner is required.")).toBeVisible();
  });
});
