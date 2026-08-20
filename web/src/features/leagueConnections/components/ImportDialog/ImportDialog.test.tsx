import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type {
  Onboarding,
  OnboardingLeague,
} from "../../../../shared/api/onboarding/onboardingSchema";
import {
  leagueImportFixture,
  syncedConnectionFixture,
} from "../../api/leagueConnections.fixture";
import { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { ImportDialog } from "./ImportDialog";

beforeAll(() => {
  Object.defineProperties(Element.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    releasePointerCapture: { configurable: true, value: () => undefined },
    scrollIntoView: { configurable: true, value: () => undefined },
    setPointerCapture: { configurable: true, value: () => undefined },
  });
});

const onboardingLeague = (
  leagueName: string,
  seasonId: string,
  canManageLeague: boolean,
): OnboardingLeague => ({
  canManageLeague,
  leagueId: `league-${seasonId}`,
  leagueName,
  leagueSlug: leagueName.toLowerCase().replaceAll(" ", "-"),
  liveDraft: null,
  membership: { role: "owner" },
  readiness: { leagueSetup: "ready", liveDraft: "ready", teamClaim: "ready" },
  seasonId,
  seasonYear: 2026,
});

const onboarding: Onboarding = {
  account: { email: "owner@example.com", id: "account-1" },
  leagues: [
    onboardingLeague("Sunday Games", "season-1", true),
    onboardingLeague("Someone else's league", "season-2", false),
  ],
};

const pathOf = (target: RequestInfo | URL): string => {
  if (typeof target === "string") return target;
  return target instanceof URL ? target.href : target.url;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const Harness = ({ onClose }: { readonly onClose: () => void }) => {
  const mutations = useLeagueConnectionMutations();
  return <ImportDialog
    connection={syncedConnectionFixture}
    mutations={mutations}
    onClose={onClose}
  />;
};

const renderDialog = (respond: (path: string) => Response | Promise<Response>) => {
  const bodies: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (target: RequestInfo | URL, init?: RequestInit) => {
    const path = pathOf(target);
    if (init?.body !== undefined && typeof init.body === "string") {
      bodies.push(JSON.parse(init.body));
    }
    return await respond(path);
  }));
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><Harness onClose={onClose} /></QueryClientProvider>);
  return { bodies, onClose };
};

const importsFine = (path: string): Response => jsonResponse(
  path === "/onboarding" ? onboarding : leagueImportFixture,
);

describe("ImportDialog", () => {
  it("builds a new league by default and closes once it lands", async () => {
    const user = userEvent.setup();
    const { bodies, onClose } = renderDialog(importsFine);

    expect(screen.getByRole("heading", { name: "Import this league" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() => { expect(onClose).toHaveBeenCalledOnce(); });
    expect(bodies).toEqual([{ mode: "create" }]);
  });

  it("replaces a league the owner already runs when they pick one", async () => {
    const user = userEvent.setup();
    const { bodies } = renderDialog(importsFine);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "A league you already run, replaced" }))
        .toBeEnabled();
    });
    await user.click(screen.getByRole("radio", { name: "A league you already run, replaced" }));
    await user.click(screen.getByRole("combobox", { name: "League to replace" }));
    await user.click(screen.getByRole("option", { name: "Sunday Games" }));
    await user.click(screen.getByRole("button", { name: "Import league" }));

    await waitFor(() => { expect(bodies).toHaveLength(1); });
    expect(bodies[0]).toEqual({ mode: "overwrite", seasonId: "season-1" });
  });

  it("waits for a league to be named before it will replace anything", async () => {
    const user = userEvent.setup();
    renderDialog(importsFine);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: "A league you already run, replaced" }))
        .toBeEnabled();
    });
    await user.click(screen.getByRole("radio", { name: "A league you already run, replaced" }));

    expect(screen.getByRole("button", { name: "Import league" })).toBeDisabled();
  });

  it("lists every reason the server refused the import", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(path => path === "/onboarding"
      ? jsonResponse(onboarding)
      : jsonResponse({
        error: {
          code: "import_needs_review",
          message: "This league needs a look first.",
          issues: ["ESPN roster slot HC is not supported."],
        },
      }, 422));

    await user.click(screen.getByRole("button", { name: "Import league" }));

    expect(await screen.findByText("This league needs a look first.")).toBeVisible();
    expect(screen.getByText("ESPN roster slot HC is not supported.")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a refusal that names no settings at all", async () => {
    const user = userEvent.setup();
    renderDialog(path => path === "/onboarding"
      ? jsonResponse(onboarding)
      : jsonResponse({
        error: { code: "snapshot_required", message: "Sync this league before importing it." },
      }, 409));

    await user.click(screen.getByRole("button", { name: "Import league" }));

    expect(await screen.findByText("Sync this league before importing it.")).toBeVisible();
  });

  it("says it is still checking which leagues the owner runs", () => {
    renderDialog(() => new Promise<Response>(() => undefined));

    expect(screen.getByText("Checking which leagues you already run...")).toBeVisible();
    expect(screen.getByRole("radio", { name: "A league you already run, replaced" }))
      .toBeDisabled();
  });

  it("explains that there is nothing to replace yet", async () => {
    renderDialog(path => jsonResponse(path === "/onboarding"
      ? { ...onboarding, leagues: [] }
      : leagueImportFixture));

    expect(await screen.findByText(
      "You do not run a league here yet, so this import will build a new one.",
    )).toBeVisible();
  });

  it("says it is importing while the league is being built", async () => {
    const user = userEvent.setup();
    renderDialog(path => path === "/onboarding"
      ? jsonResponse(onboarding)
      : new Promise<Response>(() => undefined));

    await user.click(screen.getByRole("button", { name: "Import league" }));

    expect(await screen.findByRole("button", { name: "Importing..." })).toBeDisabled();
  });

  it("leaves the league alone when the owner backs out", async () => {
    const user = userEvent.setup();
    const { bodies, onClose } = renderDialog(importsFine);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(bodies).toEqual([]);
  });

  it("closes when the dialog itself is dismissed", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog(importsFine);

    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
