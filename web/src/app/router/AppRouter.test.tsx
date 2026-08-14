import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRouter } from "./AppRouter";
import { appRoutes } from "./appRoutes";

describe("AppRouter", () => {
  it("renders the Practice workspace through the supplied router", async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ["/practice"] });

    render(<AppRouter router={router} />);

    expect(await screen.findByRole("heading", { name: "Draft lab" })).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
  });
});
