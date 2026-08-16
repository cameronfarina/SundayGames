import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin, type ProxyOptions, type UserConfig } from "vite";

const frontendRuntimePath = "/__mockd/frontend-runtime";
const defaultPlatformTarget = "http://127.0.0.1:4320";
const defaultWebPort = 4319;
const apiRoots: readonly string[] = [
  "accounts", "api", "email-verifications", "healthz", "historical-imports",
  "invitations", "league-imports", "leagues", "live-rooms", "onboarding",
  "password-resets", "player-catalog", "practice-shortlist", "readyz",
  "season-mock-drafts", "season-simulations", "seasons", "session", "sessions",
];

export interface WebViteConfigOptions {
  readonly platformTarget: string;
  readonly root: string;
  readonly runtimeId: string;
  readonly webPort: number;
}

const runtimePlugin = (runtimeId: string): Plugin => ({
  name: "mockd-frontend-runtime",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use(frontendRuntimePath, (_request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ mode: "vite-hmr", runtimeId }));
    });
  },
  transformIndexHtml() {
    return [{
      tag: "meta",
      attrs: { content: runtimeId, name: "mockd-frontend-runtime" },
      injectTo: "head",
    }];
  },
});

const apiProxyFor = (target: string): Record<string, ProxyOptions> => ({
  [`^/(${apiRoots.join("|")})(?:/|\\?|$)`]: {
    target,
    changeOrigin: false,
  },
});

export const createWebViteConfig = (options: WebViteConfigOptions): UserConfig => ({
  root: options.root,
  plugins: [react(), runtimePlugin(options.runtimeId)],
  server: {
    host: "127.0.0.1",
    port: options.webPort,
    proxy: apiProxyFor(options.platformTarget),
    strictPort: true,
  },
  build: {
    outDir: "../dist/web",
    emptyOutDir: true,
    manifest: true,
    sourcemap: false,
  },
});

const positivePort = (value: string | undefined): number => {
  const port = Number(value ?? defaultWebPort);
  return Number.isInteger(port) && port >= 0 && port <= 65_535 ? port : defaultWebPort;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return createWebViteConfig({
    platformTarget: env["MOCKD_PLATFORM_DEV_URL"] ?? defaultPlatformTarget,
    root: "web",
    runtimeId: env["MOCKD_FRONTEND_RUNTIME_ID"] ?? "vite-hmr",
    webPort: positivePort(env["MOCKD_WEB_DEV_PORT"]),
  });
});
