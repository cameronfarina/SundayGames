import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteEffects } from "./RouteEffects";

function RouteHarness() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <RouteEffects />
      <button onClick={() => void navigate("/league")} type="button">League</button>
      <button onClick={() => void navigate("/league#details")} type="button">League details</button>
      <button onClick={() => void navigate("#details")} type="button">Details</button>
      <button onClick={() => void navigate("?round=2")} type="button">Round 2</button>
      <main data-route-focus tabIndex={-1}>Page</main>
      <section id="details">Draft details</section>
      <output aria-label="Location">{`${location.pathname}${location.search}${location.hash}`}</output>
    </>
  );
}

describe("RouteEffects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates title, resets scroll, and focuses content after pathname navigation", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<MemoryRouter initialEntries={["/practice"]}><RouteHarness /></MemoryRouter>);

    await waitFor(() => {
      expect(document.title).toBe("Draft lab | Mockd");
    });
    scrollTo.mockClear();
    const focus = vi.spyOn(screen.getByRole("main"), "focus");
    await user.click(screen.getByRole("button", { name: "League" }));

    await waitFor(() => {
      expect(document.title).toBe("League | Mockd");
    });
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", left: 0, top: 0 });
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("leaves hash-only navigation to the browser", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<MemoryRouter initialEntries={["/practice"]}><RouteHarness /></MemoryRouter>);

    await waitFor(() => {
      expect(document.title).toBe("Draft lab | Mockd");
    });
    scrollTo.mockClear();
    const focus = vi.spyOn(screen.getByRole("main"), "focus");
    await user.click(screen.getByRole("button", { name: "Details" }));

    expect(screen.getByRole("status", { name: "Location" })).toHaveTextContent("/practice#details");
    expect(scrollTo).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it("does not override an anchor on pathname navigation", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<MemoryRouter initialEntries={["/practice"]}><RouteHarness /></MemoryRouter>);

    await waitFor(() => {
      expect(document.title).toBe("Draft lab | Mockd");
    });
    scrollTo.mockClear();
    const focus = vi.spyOn(screen.getByRole("main"), "focus");
    await user.click(screen.getByRole("button", { name: "League details" }));

    expect(document.title).toBe("League | Mockd");
    expect(screen.getByRole("status", { name: "Location" })).toHaveTextContent("/league#details");
    expect(scrollTo).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });

  it("does not reset scroll or focus for query-only navigation", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    render(<MemoryRouter initialEntries={["/practice"]}><RouteHarness /></MemoryRouter>);

    await waitFor(() => {
      expect(document.title).toBe("Draft lab | Mockd");
    });
    scrollTo.mockClear();
    const focus = vi.spyOn(screen.getByRole("main"), "focus");
    await user.click(screen.getByRole("button", { name: "Round 2" }));

    expect(screen.getByRole("status", { name: "Location" })).toHaveTextContent("/practice?round=2");
    expect(scrollTo).not.toHaveBeenCalled();
    expect(focus).not.toHaveBeenCalled();
  });
});
