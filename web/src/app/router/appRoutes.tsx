import type { QueryClient } from "@tanstack/react-query";
import { Navigate, type RouteObject } from "react-router-dom";
import { authRoutes } from "../../features/auth/routes/authRoutes";
import { createProtectedLoader } from "../../features/auth/routes/protectedLoader";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { RouteErrorPage } from "./RouteErrorPage/RouteErrorPage";

export const createAppRoutes = (queryClient: QueryClient): RouteObject[] => [
  ...authRoutes,
  {
    path: "invite",
    lazy: () => import("../../features/invitations/routes/invitationRoute"),
    errorElement: <RouteErrorPage />,
  },
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    loader: createProtectedLoader(queryClient),
    children: [
      { index: true, element: <Navigate replace to="/practice" /> },
      {
        path: "practice",
        lazy: () => import("../../features/practice/routes/practiceRoute"),
      },
      {
        path: "league",
        lazy: () => import("../../features/league/routes/leagueRoute"),
      },
      {
        path: "my-team",
        lazy: () => import("../../features/myTeam/routes/myTeamRoute"),
      },
    ],
  },
];
