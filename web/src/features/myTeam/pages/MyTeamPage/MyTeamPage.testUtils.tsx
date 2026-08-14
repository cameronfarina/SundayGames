import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { MyTeamPage } from "./MyTeamPage";

export const renderMyTeamPage = (url = "/my-team?seasonId=season-2026"): ReactElement => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <MyTeamPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

  render(view);
  return view;
};
