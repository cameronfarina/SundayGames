import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingLayout } from "./LandingLayout";

const renderLayout = () => {
  const router = createMemoryRouter(
    [{ element: <LandingLayout />, children: [{ index: true, element: <p>page</p> }] }],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
};

describe("LandingLayout", () => {
  it("owns the main landmark the page renders into", () => {
    renderLayout();

    expect(screen.getByRole("main")).toBeVisible();
    expect(screen.getByText("page")).toBeVisible();
  });

  it("wraps the page in the signed-out header and footer", () => {
    renderLayout();

    expect(screen.getByRole("banner")).toBeVisible();
    expect(screen.getByRole("contentinfo")).toBeVisible();
  });
});
