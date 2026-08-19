import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LiveDraftPage } from "./LiveDraftPage";
import { darkAdvisory, liveRoom } from "../../test/liveDraftFixtures";

// FantasyPros is dark by default, so every existing expectation describes the
// board exactly as it renders without the overlay.
export const liveDraftServer = setupServer(
  http.get("/live-rooms/:roomId/advisory", () => HttpResponse.json(darkAdvisory)),
);

export const useRoomResponse = (room = liveRoom) => {
  liveDraftServer.use(http.get("/live-rooms/:roomId", () => HttpResponse.json({ room })));
};

export const useAdvisoryResponse = (advisory = darkAdvisory) => {
  liveDraftServer.use(
    http.get("/live-rooms/:roomId/advisory", () => HttpResponse.json(advisory)),
  );
};

export const renderLiveDraftPage = (entry = "/draft-room?seasonId=season-1&roomId=room-1") => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}><Routes>
        <Route path="/draft-room" element={<LiveDraftPage />} />
        <Route path="/leagues/:leagueSlug/draft" element={<LiveDraftPage />} />
      </Routes></MemoryRouter>
    </QueryClientProvider>,
  );
};
