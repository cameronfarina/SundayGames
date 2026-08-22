import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPlatformNodeHttpAdapter } from "../src/platform/platformNodeHttp.js";
import { loadPlatformStaticWebAssets } from "../src/platform/platformStaticWebAssets.js";

let server: Server | undefined;
let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (server !== undefined) {
    await new Promise<void>((resolve, reject) => {
      server?.close(error => error === undefined ? resolve() : reject(error));
    });
  }
  if (temporaryDirectory !== undefined) {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
  server = undefined;
  temporaryDirectory = undefined;
});

const listen = async (assetsDirectory: string): Promise<string> => {
  const assets = await loadPlatformStaticWebAssets(assetsDirectory);
  server = createServer(createPlatformNodeHttpAdapter(async () => ({
    status: 404,
    body: { error: { code: "not_found", message: "Not found." } },
  }), {
    appHtml: assets.indexHtml,
    browserAssets: assets.files,
  }));
  await new Promise<void>((resolve, reject) => {
    server?.once("error", reject);
    server?.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected test server address.");
  }

  return `http://127.0.0.1:${address.port}`;
};

describe("platform static web assets", () => {
  it("loads the React index and serves immutable hashed assets", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-react-assets-"));
    await mkdir(join(temporaryDirectory, "assets"));
    await writeFile(join(temporaryDirectory, "index.html"), "<!doctype html><div id=\"root\"></div>");
    await writeFile(join(temporaryDirectory, "assets", "app-a1b2c3.js"), "window.mockd = true;");
    const baseUrl = await listen(temporaryDirectory);

    const page = await fetch(`${baseUrl}/leagues/sunday-games/practice`);
    const asset = await fetch(`${baseUrl}/assets/app-a1b2c3.js`);

    expect(await page.text()).toContain("id=\"root\"");
    expect(asset.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(await asset.text()).toBe("window.mockd = true;");
  });

  it("serves the React app for live drafts and supports asset HEAD requests", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-react-assets-"));
    await mkdir(join(temporaryDirectory, "assets"));
    await writeFile(join(temporaryDirectory, "index.html"), "<!doctype html><div id=\"root\"></div>");
    await writeFile(join(temporaryDirectory, "assets", "app-a1b2c3.css"), "body { color: white; }");
    const baseUrl = await listen(temporaryDirectory);

    const liveDraft = await fetch(`${baseUrl}/draft-room`);
    const asset = await fetch(`${baseUrl}/assets/app-a1b2c3.css`, { method: "HEAD" });

    expect(await liveDraft.text()).toContain("id=\"root\"");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-length")).toBe(String(Buffer.byteLength("body { color: white; }")));
    expect(await asset.text()).toBe("");
  });

  it("serves the React app for account and creator dashboard deep links", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "mockd-react-assets-"));
    await writeFile(
      join(temporaryDirectory, "index.html"),
      "<!doctype html><div id=\"root\"></div>",
    );
    const baseUrl = await listen(temporaryDirectory);

    const account = await fetch(`${baseUrl}/account`);
    const creatorDrafts = await fetch(`${baseUrl}/platform-admin/drafts`);

    expect(account.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await account.text()).toContain("id=\"root\"");
    expect(creatorDrafts.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await creatorDrafts.text()).toContain("id=\"root\"");
  });
});
