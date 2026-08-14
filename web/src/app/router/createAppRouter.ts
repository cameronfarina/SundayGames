import { createBrowserRouter } from "react-router-dom";
import type { RouterProviderProps } from "react-router-dom";
import { createAppRoutes } from "./appRoutes";

export const createAppRouter = (queryClient: QueryClient): RouterProviderProps["router"] =>
  createBrowserRouter(createAppRoutes(queryClient));
import type { QueryClient } from "@tanstack/react-query";
