import { RouterProvider } from "react-router-dom";
import type { RouterProviderProps } from "react-router-dom";

interface AppRouterProps {
  readonly router: RouterProviderProps["router"];
}

export function AppRouter({ router }: AppRouterProps) {
  return <RouterProvider router={router} />;
}
