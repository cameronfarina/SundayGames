import { render, screen, waitFor } from "@testing-library/react";
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

  it("refreshes the tab once when a page file is missing after a deploy", async () => {
    window.sessionStorage.removeItem("staleChunkReloadedFor");
    const router = createMemoryRouter([{
      path: "/player-news",
      loader: () => {
        throw new TypeError(
          "Failed to fetch dynamically imported module: https://sundaygames.io/assets/playerNewsRoute-btdGVP8y.js",
        );
      },
      element: <p>Never rendered</p>,
      errorElement: <RouteErrorPage />,
    }], { initialEntries: ["/player-news"] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("We updated the site while this tab was open. Refresh the page to continue.");
    // The message renders on the first pass, so the alert can resolve before the
    // reload effect has run. Wait for the effect instead of racing it.
    await waitFor(() => {
      expect(window.sessionStorage.getItem("staleChunkReloadedFor")).not.toBeNull();
    });
  });

  it("refreshes the tab once when a page stylesheet is missing after a deploy", async () => {
    window.sessionStorage.removeItem("staleChunkReloadedFor");
    const router = createMemoryRouter([{
      path: "/commissioner",
      loader: () => {
        throw new TypeError(
          "Unable to preload CSS for https://sundaygames.io/assets/commissionerRoute-DywplrXn.css",
        );
      },
      element: <p>Never rendered</p>,
      errorElement: <RouteErrorPage />,
    }], { initialEntries: ["/commissioner"] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("We updated the site while this tab was open. Refresh the page to continue.");
    await waitFor(() => {
      expect(window.sessionStorage.getItem("staleChunkReloadedFor")).not.toBeNull();
    });
  });
});
