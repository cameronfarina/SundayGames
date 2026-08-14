import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { CreateLeagueWizard } from "../components/CreateLeagueWizard/CreateLeagueWizard";

export const renderCreateLeagueWizard = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const wizard = (open: boolean) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CreateLeagueWizard open={open} onClose={onClose} onCreated={onCreated} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(wizard(true));
  return {
    ...result,
    onClose,
    onCreated,
    queryClient,
    setOpen: (open: boolean) => { result.rerender(wizard(open)); },
  };
};
