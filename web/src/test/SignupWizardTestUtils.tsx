import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SignupWizard } from "../features/accountOnboarding/components/SignupWizard/SignupWizard";
import { sessionQueryKey } from "../features/auth/api/sessionQuery";

export const account = {
  createdAt: "2026-08-21T12:00:00.000Z",
  email: "new@example.com",
  id: "account-new",
  updatedAt: "2026-08-21T12:00:00.000Z",
};

export const providers = [{
  availability: "connectable",
  detail: "Sleeper leagues connect with just a username.",
  handleHint: "Your Sleeper username",
  handleKind: "sleeper-username",
  handleLabel: "Sleeper username",
  handleNamesOneLeague: false,
  label: "Sleeper",
  provider: "sleeper",
  supportsAccountDiscovery: true,
  supportsCookieCredentials: false,
}, {
  availability: "connectable",
  detail: "Paste a public ESPN league link.",
  handleHint: "League URL or ID",
  handleKind: "espn-league-id",
  handleLabel: "ESPN league ID or league URL",
  handleNamesOneLeague: true,
  label: "ESPN",
  provider: "espn",
  supportsAccountDiscovery: true,
  supportsCookieCredentials: true,
}];

export const pathFor = (input: RequestInfo | URL): string => {
  if (input instanceof Request) return new URL(input.url).pathname;
  if (input instanceof URL) return input.pathname;
  return input;
};

export const requestBody = (body: BodyInit | null | undefined): Record<string, unknown> => {
  if (typeof body !== "string") throw new Error("Expected a JSON request body.");
  const value: unknown = JSON.parse(body);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a JSON object request body.");
  }
  return Object.fromEntries(Object.entries(value));
};

export const mountWizard = (
  stage: "intent" | "providers" | "connections" = "intent",
  connectionProviders: readonly string[] | null = ["espn", "sleeper", "other"],
) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(sessionQueryKey(), {
    account,
    onboarding: {
      intent: stage === "intent" ? null : "practice",
      providers: stage === "connections" ? connectionProviders : null,
      stage,
    },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><SignupWizard /></MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
};

export const mountWizardWithoutSession = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><SignupWizard /></MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
};
