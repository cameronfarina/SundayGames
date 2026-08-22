import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AccountUpcomingDrafts } from "./AccountUpcomingDrafts";

describe("AccountUpcomingDrafts", () => {
  it("explains when no league has a future draft", () => {
    render(<MemoryRouter><AccountUpcomingDrafts leagues={[]} /></MemoryRouter>);

    expect(screen.getByText("No drafts are scheduled yet.")).toBeVisible();
  });
});
