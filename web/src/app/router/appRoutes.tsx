import { Navigate, type RouteObject } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout/AppLayout";

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate replace to="/practice" /> },
      {
        path: "practice",
        lazy: () => import("../../features/practice/routes/practiceRoute"),
      },
    ],
  },
];
