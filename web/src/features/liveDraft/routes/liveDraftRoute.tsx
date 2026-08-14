import type { RouteObject } from "react-router-dom";
import { LiveDraftPage } from "../pages/LiveDraftPage/LiveDraftPage";

export const liveDraftRoute = {
  path: "draft-room",
  Component: LiveDraftPage,
} satisfies RouteObject;
