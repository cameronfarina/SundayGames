import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { InvitationPage } from "./InvitationPage";

export const invitationServer = setupServer();
const unmountInvitationPages: (() => void)[] = [];

export const resetInvitationPages = () => {
  unmountInvitationPages.splice(0).forEach((unmount) => {
    unmount();
  });
};

export const invitationDetails = {
  invitation: { id: "invite-1", seasonId: "season-1", kind: "league" },
  league: { id: "league-1", name: "Sunday Games", seasonYear: 2026 },
  teams: [
    {
      id: "team-1",
      ownerId: "owner-1",
      name: "Short King",
      managerNames: ["Owner11"],
      status: "available",
    },
    {
      id: "team-2",
      ownerId: "owner-2",
      name: "Old Dogs",
      managerNames: ["Juice"],
      status: "claimed",
    },
  ],
};

export const useInvitationApi = (signedIn: boolean) => {
  invitationServer.use(
    http.get("/invitations/details", () => HttpResponse.json(invitationDetails)),
    http.get("/session", () => signedIn
      ? HttpResponse.json({ account: { id: "user-1", email: "user@example.com" } })
      : HttpResponse.json({
          error: { code: "authentication_required", message: "Sign in." },
        }, { status: 401 })),
    http.get("/onboarding", () => HttpResponse.json({
      account: { id: "user-1", email: "user@example.com" },
      leagues: [],
    })),
  );
};

interface RenderInvitationPageOptions {
  readonly destination?: ReactNode;
  readonly queryClient?: QueryClient;
}

export const renderInvitationPage = (
  entry = "/invite?token=secret",
  options: RenderInvitationPageOptions = {},
) => {
  const queryClient = options.queryClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/invite" element={<InvitationPage />} />
          <Route path="/league" element={options.destination ?? <h1>League destination</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  unmountInvitationPages.push(result.unmount);
  return result;
};
