import { Navigate, type RouteObject } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { RouteErrorPage } from "./RouteErrorPage/RouteErrorPage";

export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate replace to="/practice" /> },
      {
        path: "practice",
        lazy: () => import("../../features/practice/routes/practiceRoute"),
      },
    ],
  },
];
