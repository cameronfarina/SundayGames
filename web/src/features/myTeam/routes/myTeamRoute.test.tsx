import { describe, expect, it } from "vitest";
import { MyTeamPage } from "../pages/MyTeamPage/MyTeamPage";
import { myTeamRoute } from "./myTeamRoute";

describe("myTeamRoute", () => {
  it("exports the My Team route for parent integration", () => {
    expect(myTeamRoute.path).toBe("my-team");
    expect(myTeamRoute.Component).toBe(MyTeamPage);
  });
});
