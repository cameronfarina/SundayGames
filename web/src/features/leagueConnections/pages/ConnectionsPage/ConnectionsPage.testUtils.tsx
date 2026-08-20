import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConnectionsPage } from "./ConnectionsPage";

// The page scrolls the opened league into view, which jsdom does not implement.
Object.defineProperty(Element.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
  writable: true,
});

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
