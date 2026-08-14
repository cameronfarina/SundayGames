import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppLayout } from "./AppLayout";

const renderLayout = () => render(
  <MemoryRouter initialEntries={["/practice"]}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="practice" element={<h1>Draft lab</h1>} />
        <Route path="league" element={<h1>League home</h1>} />
      </Route>
    </Routes>
  </MemoryRouter>,
);

describe("AppLayout", () => {
  it("offers keyboard users a skip link and focusable page content", async () => {
    const user = userEvent.setup();
    renderLayout();

    screen.getByRole("main").blur();
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("uses client navigation without replacing the document", async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole("link", { name: "League" }));

    expect(await screen.findByRole("heading", { name: "League home" })).toBeVisible();
    expect(document.title).toBe("League | Mockd");
  });
});
