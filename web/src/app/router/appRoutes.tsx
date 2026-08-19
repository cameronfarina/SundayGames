import type { QueryClient } from "@tanstack/react-query";
import { Navigate, type RouteObject } from "react-router-dom";
import { authRoutes } from "../../features/auth/routes/authRoutes";
import { createProtectedLoader } from "../../features/auth/routes/protectedLoader";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { PublicLayout } from "../layouts/PublicLayout/PublicLayout";
import { RouteErrorPage } from "./RouteErrorPage/RouteErrorPage";

export const createAppRoutes = (queryClient: QueryClient): RouteObject[] => [
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      ...authRoutes,
      {
        path: "invite",
        lazy: () => import("../../features/invitations/routes/invitationRoute"),
      },
    ],
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
        path: "mock-drafts",
        lazy: () => import("../../features/mockDraft/routes/mockDraftRoute"),
      },
      {
        path: "draft-room",
        lazy: () => import("../../features/liveDraft/routes/liveDraftRoute"),
      },
      {
        path: "league",
        lazy: () => import("../../features/league/routes/leagueRoute"),
      },
      {
        path: "my-team",
        lazy: () => import("../../features/myTeam/routes/myTeamRoute"),
      },
      {
        path: "player-news",
        lazy: () => import("../../features/playerNews/routes/playerNewsRoute"),
      },
      {
        path: "connections",
        lazy: () => import("../../features/leagueConnections/routes/connectionsRoute"),
      },
      {
        path: "commissioner",
        lazy: () => import("../../features/commissioner/routes/commissionerRoute"),
      },
      {
        path: "leagues/:leagueSlug",
        lazy: () => import("../../features/league/routes/leagueRoute"),
      },
      {
        path: "leagues/:leagueSlug/practice",
        lazy: () => import("../../features/practice/routes/practiceRoute"),
      },
      {
        path: "leagues/:leagueSlug/mock-drafts",
        lazy: () => import("../../features/mockDraft/routes/mockDraftRoute"),
      },
      {
        path: "leagues/:leagueSlug/draft",
        lazy: () => import("../../features/liveDraft/routes/liveDraftRoute"),
      },
      {
        path: "leagues/:leagueSlug/my-team",
        lazy: () => import("../../features/myTeam/routes/myTeamRoute"),
      },
      {
        path: "leagues/:leagueSlug/player-news",
        lazy: () => import("../../features/playerNews/routes/playerNewsRoute"),
      },
      {
        path: "leagues/:leagueSlug/commissioner",
        lazy: () => import("../../features/commissioner/routes/commissionerRoute"),
      },
    ],
  },
];
