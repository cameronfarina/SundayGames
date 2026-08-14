import type { RouteObject } from "react-router-dom";
import { MyTeamPage } from "../pages/MyTeamPage/MyTeamPage";

export const myTeamRoute = {
  path: "my-team",
  Component: MyTeamPage,
} satisfies RouteObject;
