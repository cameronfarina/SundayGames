import { Navigate, type RouteObject } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { RouteErrorPage } from "./RouteErrorPage/RouteErrorPage";

export const appRoutes: RouteObject[] = [
  {
    path: "invite",
    lazy: () => import("../../features/invitations/routes/invitationRoute"),
    errorElement: <RouteErrorPage />,
  },
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
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
