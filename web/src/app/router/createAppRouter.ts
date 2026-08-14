import { createBrowserRouter } from "react-router-dom";
import type { RouterProviderProps } from "react-router-dom";
import { appRoutes } from "./appRoutes";

export const createAppRouter = (): RouterProviderProps["router"] => createBrowserRouter(appRoutes);
