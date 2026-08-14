import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionQueryKey } from "../../../features/auth/api/sessionQuery";
import { PracticePage } from "../../../features/practice/pages/PracticePage/PracticePage";
import { createPracticeFetch } from "../../../features/practice/pages/PracticePage/test/createPracticeFetch";
import { ProductHeader } from "../../components/ProductHeader/ProductHeader";

afterEach(() => {
  vi.unstubAllGlobals();
});

const requestPath = (input: RequestInfo | URL): string => {
  if (input instanceof Request) return new URL(input.url).pathname;
  if (input instanceof URL) return input.pathname;
  return new URL(input, "http://mockd.test").pathname;
};

describe("authenticated onboarding cache", () => {
  it("shares one onboarding request between the product header and active page", async () => {
    const fetcher = vi.fn(createPracticeFetch());
    vi.stubGlobal("fetch", fetcher);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(sessionQueryKey(), {
      account: {
        createdAt: "2026-08-13T12:00:00.000Z",
        email: "user@example.com",
        id: "account-1",
        updatedAt: "2026-08-13T12:00:00.000Z",
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/practice?seasonId=season-1"]}>
          <ProductHeader />
          <main><PracticePage /></main>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Draft lab" })).toBeVisible();
    await waitFor(() => {
      const onboardingCalls = fetcher.mock.calls.filter(([input]) => (
        requestPath(input) === "/onboarding"
      ));
      expect(onboardingCalls).toHaveLength(1);
    });
  });
});
