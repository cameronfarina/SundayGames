import { describe, expect, it } from "vitest";
import { LiveDraftPage } from "../pages/LiveDraftPage/LiveDraftPage";
import { liveDraftRoute } from "./liveDraftRoute";

describe("liveDraftRoute", () => {
  it("routes draft-room URLs to the live draft page", () => {
    expect(liveDraftRoute).toEqual({ path: "draft-room", Component: LiveDraftPage });
  });
});
