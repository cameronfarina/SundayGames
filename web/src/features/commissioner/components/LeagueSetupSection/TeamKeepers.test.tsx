import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommissionerKeeper } from "../../api/workspaceSchemas";
import { jsonResponse, requestBody } from "../../test/commissionerFixtures";
import { TeamKeepers } from "./TeamKeepers";

const chase: CommissionerKeeper = {
  teamId: "team-1", playerId: "jamarr-chase", playerName: "Ja'Marr Chase", position: "WR", price: 40,
};
const gibbs: CommissionerKeeper = {
  teamId: "team-1", playerId: "jahmyr-gibbs", playerName: "Jahmyr Gibbs", position: "RB", price: 22,
};

const captureKeeperCalls = (
  keepers: readonly CommissionerKeeper[],
  respond: () => Promise<Response> = () => Promise.resolve(jsonResponse({ keepers: [] })),
) => {
  const calls: { body: string }[] = [];
  vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ body: requestBody(init) });
    return respond();
  }));
  render(<QueryClientProvider client={new QueryClient()}>
    <TeamKeepers keepers={keepers} savedOwnerDisplayName="Ty" seasonId="season-1" teamId="team-1" />
  </QueryClientProvider>);
  return calls;
};

describe("TeamKeepers", () => {
  afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

  it("shows every keeper this team holds", () => {
    captureKeeperCalls([chase, gibbs]);

    expect(screen.getByText("Ja'Marr Chase $40")).toBeVisible();
    expect(screen.getByText("Jahmyr Gibbs $22")).toBeVisible();
  });

  it("shows a snake keeper by its round instead of a price", () => {
    captureKeeperCalls([{ ...chase, playerId: undefined, price: 0, keeperRound: 3 }]);

    expect(screen.getByText("Ja'Marr Chase R3")).toBeVisible();
  });

  it("offers no remove for a keeper the season cannot identify", () => {
    captureKeeperCalls([{ ...chase, playerId: undefined }]);

    expect(screen.queryByRole("button", { name: /^Remove/u })).not.toBeInTheDocument();
  });

  it("names the team when adding, so the commissioner types only the player", async () => {
    const calls = captureKeeperCalls([]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Keeper" }));
    await user.type(screen.getByLabelText("Keeper for Ty"), "Chase 40");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(calls.at(-1)?.body).toContain("Ty keeping Chase 40");
  });

  it("saves on Enter and gives up on Escape", async () => {
    const calls = captureKeeperCalls([]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Keeper" }));
    await user.type(screen.getByLabelText("Keeper for Ty"), "Chase 40{Escape}");
    expect(screen.getByRole("button", { name: "+ Keeper" })).toBeVisible();
    expect(calls).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "+ Keeper" }));
    await user.type(screen.getByLabelText("Keeper for Ty"), "Gibbs 22{Enter}");
    expect(calls.at(-1)?.body).toContain("Ty keeping Gibbs 22");
  });

  it("removes the keeper the commissioner picks", async () => {
    const calls = captureKeeperCalls([chase, gibbs]);

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Remove Jahmyr Gibbs from Ty" }),
    );

    expect(calls.at(-1)?.body).toContain("jahmyr-gibbs");
  });

  it("closes the field when the commissioner cancels", async () => {
    const calls = captureKeeperCalls([]);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Keeper" }));
    await user.type(screen.getByLabelText("Keeper for Ty"), "Chase 40");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "+ Keeper" })).toBeVisible();
    expect(calls).toHaveLength(0);
  });

  it("shows why a keeper could not be removed", async () => {
    captureKeeperCalls([chase], () => Promise.resolve(jsonResponse({
      error: { code: "remove_failed", message: "Keeper could not be removed." },
    }, 422)));

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Remove Ja'Marr Chase from Ty" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Keeper could not be removed.");
  });

  it("labels the save while the keeper is on its way", async () => {
    captureKeeperCalls([], () => new Promise<Response>(() => undefined));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Keeper" }));
    await user.type(screen.getByLabelText("Keeper for Ty"), "Chase 40{Enter}");

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  });

  it("shows why a keeper was refused", async () => {
    captureKeeperCalls([], () => Promise.resolve(jsonResponse({
      error: { code: "unknown_player", message: "No player matched \"Chace\"." },
    }, 400)));
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "+ Keeper" }));
    await user.type(screen.getByLabelText("Keeper for Ty"), "Chace 40{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("No player matched \"Chace\".");
  });
});
