import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

interface AppProvidersProps extends PropsWithChildren {
  readonly queryClient: QueryClient;
}

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
