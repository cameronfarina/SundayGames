import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { sessionQueryKey } from "../../../features/auth/api/sessionQuery";
import { onboardingQueryOptions } from "../../../features/myTeam/api/myTeamQueryOptions";
import { AppLayout } from "./AppLayout";

const renderLayout = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(sessionQueryKey(), {
    account: {
      createdAt: "2026-08-13T12:00:00.000Z",
      email: "cam@example.com",
      id: "account-cam",
      updatedAt: "2026-08-13T12:00:00.000Z",
    },
  });
  queryClient.setQueryData(onboardingQueryOptions().queryKey, {
    account: { email: "cam@example.com", id: "account-cam" },
    leagues: [],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/practice"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="practice" element={<h1>Draft lab</h1>} />
            <Route path="league" element={<h1>League home</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("AppLayout", () => {
  it("offers keyboard users a skip link and focusable page content", async () => {
    const user = userEvent.setup();
    renderLayout();

    screen.getByRole("main").blur();
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("uses client navigation without replacing the document", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("link", { name: "League" }));

    expect(await screen.findByRole("heading", { name: "League home" })).toBeVisible();
    expect(document.title).toBe("League | Mockd");
  });
});
