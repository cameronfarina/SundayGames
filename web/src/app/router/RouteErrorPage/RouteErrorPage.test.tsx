import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RouteErrorPage } from "./RouteErrorPage";

describe("RouteErrorPage", () => {
  it("renders a recovery path for a failed route", async () => {
    const router = createMemoryRouter([{
      path: "/broken",
      loader: () => {
        throw new Error("Could not load this workspace.");
      },
      element: <p>Never rendered</p>,
      errorElement: <RouteErrorPage />,
    }], { initialEntries: ["/broken"] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load this workspace.");
    expect(screen.getByRole("link", { name: "Return to Practice" })).toHaveAttribute("href", "/practice");
  });
});
