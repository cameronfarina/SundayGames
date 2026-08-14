import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRouter } from "./AppRouter";
import { createAppRoutes } from "./appRoutes";

describe("AppRouter", () => {
  it("renders the Practice workspace through the supplied router", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["session"], { account: { id: "account-1" } });
    const router = createMemoryRouter(createAppRoutes(queryClient), { initialEntries: ["/practice"] });

    render(<AppRouter router={router} />);

    expect(await screen.findByRole("heading", { name: "Draft lab" })).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
  });
});
import { QueryClient } from "@tanstack/react-query";
