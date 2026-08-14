import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformApiError } from "../../../../shared/api/http/PlatformApiError";
import { useLiveDraftRoom } from "../../hooks/useLiveDraftRoom";
import { LiveDraftPage } from "./LiveDraftPage";

vi.mock("../../hooks/useLiveDraftRoom", () => ({ useLiveDraftRoom: vi.fn() }));

const controller: ReturnType<typeof useLiveDraftRoom> = {
  busy: false,
  connection: "unavailable",
  createExport: vi.fn(() => Promise.reject(new Error("not used"))),
  error: null,
  loading: false,
  refresh: vi.fn(() => Promise.resolve()),
  room: undefined,
  runAction: vi.fn(() => Promise.reject(new Error("not used"))),
};

const renderPage = () => {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>
    <MemoryRouter initialEntries={["/draft-room?seasonId=season-1&roomId=room-1"]}>
      <LiveDraftPage />
    </MemoryRouter>
  </QueryClientProvider>);
};

afterEach(() => { vi.clearAllMocks(); });

describe("LiveDraftPage controller states", () => {
  it("reports an empty successful response", () => {
    vi.mocked(useLiveDraftRoom).mockReturnValue(controller);
    renderPage();
    expect(screen.getByText("The draft room returned no data.")).toBeVisible();
  });

  it("does not offer sign in for a non-authentication error", () => {
    vi.mocked(useLiveDraftRoom).mockReturnValue({
      ...controller,
      error: new PlatformApiError({ code: "room_failed", message: "Room failed", status: 500 }),
    });
    renderPage();
    expect(screen.getByText("Room failed")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
