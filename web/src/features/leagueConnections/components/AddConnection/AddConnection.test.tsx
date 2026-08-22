import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { providerCatalogFixture } from "../../api/leagueConnections.fixture";
import { useLeagueConnectionMutations } from "../../hooks/useLeagueConnectionMutations";
import { AddConnection } from "./AddConnection";

const Harness = () => {
  const mutations = useLeagueConnectionMutations();
  return <AddConnection
    connections={[]}
    mutations={mutations}
    providers={providerCatalogFixture}
  />;
};

const renderAddConnection = () => {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter><Harness /></MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("AddConnection", () => {
  it("asks for a provider before asking for anything else", () => {
    renderAddConnection();

    expect(screen.getByRole("heading", { name: "Connect a league" })).toBeVisible();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("offers only account-wide ESPN discovery", async () => {
    const user = userEvent.setup();
    renderAddConnection();

    await user.click(screen.getByRole("tab", { name: "ESPN" }));

    expect(screen.queryByRole("textbox", { name: "ESPN league ID or league URL" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find this league" }))
      .not.toBeInTheDocument();
    expect(screen.getByLabelText("espn_s2 cookie")).toBeVisible();
    expect(screen.getByRole("button", { name: "Find my ESPN leagues" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("asks Sleeper for a username and nothing else", async () => {
    const user = userEvent.setup();
    renderAddConnection();

    await user.click(screen.getByRole("tab", { name: "Sleeper" }));

    expect(screen.getByRole("textbox", { name: "Sleeper username" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Find my leagues" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "espn_s2 cookie" })).not.toBeInTheDocument();
    expect(screen.queryByText("Only want one league? Connect it by ID")).not.toBeInTheDocument();
  });

  it("explains that Yahoo cannot be connected yet and offers no form", async () => {
    const user = userEvent.setup();
    renderAddConnection();

    await user.click(screen.getByRole("tab", { name: "Yahoo" }));

    expect(screen.getByText(/Yahoo reviews every Fantasy API application/u)).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
