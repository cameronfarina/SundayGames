import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { LiveDraftPage } from "./LiveDraftPage";
import { liveRoom } from "../../test/liveDraftFixtures";

export const liveDraftServer = setupServer();

export const useRoomResponse = (room = liveRoom) => {
  liveDraftServer.use(http.get("/live-rooms/:roomId", () => HttpResponse.json({ room })));
};

export const renderLiveDraftPage = (entry = "/draft-room?seasonId=season-1&roomId=room-1") => {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}><LiveDraftPage /></MemoryRouter>
    </QueryClientProvider>,
  );
};
