import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers/AppProviders/AppProviders";
import { AppRouter } from "./app/router/AppRouter";
import { createAppRouter } from "./app/router/createAppRouter";
import { createAppQueryClient } from "./app/query/createAppQueryClient";
import "./styles/global.css";

const queryClient = createAppQueryClient();
const router = createAppRouter(queryClient);
const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Mockd could not find its application root.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <AppRouter router={router} />
    </AppProviders>
  </StrictMode>,
);
