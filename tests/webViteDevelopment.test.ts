import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { apiRoots, createWebViteConfig } from "../web/vite.config.js";
import { appShellPaths, observableRouteRoots } from "../src/platform/platformNodeHttp/constants.js";

const page = '<div id="root"></div><script type="module" src="/message.ts"></script>';

describe("web Vite development", () => {
  let directory: string | undefined;
  let apiServer: HttpServer | undefined;
  let server: ViteDevServer | undefined;

  afterEach(async () => {
    await server?.close();
    const runningApiServer = apiServer;
    await new Promise<void>((resolveClose, reject) => {
      if (runningApiServer === undefined) return resolveClose();
      runningApiServer.close(error => error === undefined ? resolveClose() : reject(error));
    });
    if (directory !== undefined) await rm(directory, { force: true, recursive: true });
    apiServer = undefined;
    directory = undefined;
    server = undefined;
  });

  it("serves edited source without restarting or rebuilding", async () => {
    directory = await mkdtemp(join(tmpdir(), "mockd-vite-development-"));
    await writeFile(join(directory, "index.html"), page, "utf8");
    await writeFile(join(directory, "message.ts"), 'export const message = "first";', "utf8");

    const config = createWebViteConfig({
      platformTarget: "http://127.0.0.1:4320",
      root: directory,
      runtimeId: "test-runtime",
      webPort: 0,
    });
    server = await createServer({
      ...config,
      logLevel: "silent",
      server: { ...config.server, port: 0, strictPort: false },
    });
    await server.listen();

    const address = server.httpServer?.address();
    if (address === null || address === undefined || typeof address === "string") {
      throw new Error("Vite did not expose a TCP development address.");
    }
    const origin = `http://127.0.0.1:${String(address.port)}`;

    await expect(fetch(`${origin}/message.ts?version=1`).then(response => response.text()))
      .resolves.toContain('message = "first"');
    await writeFile(join(directory, "message.ts"), 'export const message = "second";', "utf8");
    await expect(fetch(`${origin}/message.ts?version=2`).then(response => response.text()))
      .resolves.toContain('message = "second"');
    await expect(fetch(`${origin}/__mockd/frontend-runtime`).then(response => response.json()))
      .resolves.toEqual({ mode: "vite-hmr", runtimeId: "test-runtime" });
    const appHtml = await fetch(`${origin}/login`).then(response => response.text());
    expect(appHtml).toContain("mockd-frontend-runtime");
    expect(appHtml).toContain("test-runtime");
  });

  it("proxies platform APIs while browser routes stay in the React app", async () => {
    let receivedCookie: string | undefined;
    apiServer = createHttpServer((request, response) => {
      receivedCookie = request.headers.cookie;
      if (request.url?.includes("/events") === true) {
        response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        response.end("event: room\ndata: {\"revision\":2}\n\n");
        return;
      }
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ path: request.url }));
    });
    await new Promise<void>((resolveListen, reject) => {
      apiServer?.once("error", reject).listen(0, "127.0.0.1", resolveListen);
    });
    const apiAddress = apiServer.address();
    if (apiAddress === null || typeof apiAddress === "string") {
      throw new Error("The test API did not expose a TCP address.");
    }

    directory = await mkdtemp(join(tmpdir(), "mockd-vite-proxy-"));
    await writeFile(join(directory, "index.html"), "<h1>React practice</h1>", "utf8");
    const config = createWebViteConfig({
      platformTarget: `http://127.0.0.1:${String(apiAddress.port)}`,
      root: directory,
      runtimeId: "proxy-test",
      webPort: 0,
    });
    server = await createServer({
      ...config,
      logLevel: "silent",
      server: { ...config.server, port: 0, strictPort: false },
    });
    await server.listen();
    const webAddress = server.httpServer?.address();
    if (webAddress === null || webAddress === undefined || typeof webAddress === "string") {
      throw new Error("Vite did not expose a TCP development address.");
    }
    const origin = `http://127.0.0.1:${String(webAddress.port)}`;

    await expect(fetch(`${origin}/session`, { headers: { cookie: "mockd_session=test" } })
      .then(response => response.json())).resolves.toEqual({ path: "/session" });
    expect(receivedCookie).toBe("mockd_session=test");
    await expect(fetch(`${origin}/session-state`).then(response => response.json()))
      .resolves.toEqual({ path: "/session-state" });
    const eventResponse = await fetch(`${origin}/live-rooms/room-1/events`);
    expect(eventResponse.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    await expect(eventResponse.text()).resolves.toContain("event: room");
    await expect(fetch(`${origin}/practice`, { headers: { accept: "text/html" } })
      .then(response => response.text())).resolves.toContain("React practice");
  });

  it("proxies every platform route root the browser does not own", () => {
    const browserRoots = new Set([...appShellPaths].map(path => path.slice(1)));
    const unproxied = [...observableRouteRoots]
      .filter(root => root !== "" && !browserRoots.has(root) && !apiRoots.includes(root));

    expect(unproxied).toEqual([]);
  });
});
