import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConnectionsPage } from "./ConnectionsPage";

export const renderConnectionsPage = (initialEntry = "/connections") => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ConnectionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
