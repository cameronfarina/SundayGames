import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../features/auth/api/sessionQuery";
import { createPracticeFetch } from "../../features/practice/pages/PracticePage/test/createPracticeFetch";
import { AppProviders } from "../providers/AppProviders/AppProviders";
import { AppRouter } from "./AppRouter";
import { createAppRoutes } from "./appRoutes";

describe("AppRouter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the Practice workspace through the supplied router", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(sessionQueryKey(), {
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "user@example.com",
        id: "account-1",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
    });
    vi.stubGlobal("fetch", createPracticeFetch());
    const router = createMemoryRouter(createAppRoutes(queryClient), { initialEntries: ["/practice"] });

    render(
      <AppProviders queryClient={queryClient}>
        <AppRouter router={router} />
      </AppProviders>,
    );

    expect(await screen.findByRole("heading", { name: "Draft lab" })).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
  });
});
