import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface BrowserExtensionManifest {
  readonly content_scripts: readonly [{
    readonly js: readonly string[];
    readonly matches: readonly string[];
    readonly run_at: string;
  }];
  readonly host_permissions: readonly string[];
  readonly manifest_version: number;
  readonly permissions: readonly string[];
}

const manifest: BrowserExtensionManifest = JSON.parse(
  readFileSync("browser-extension/manifest.json", "utf8"),
);

describe("Sunday Games ESPN browser extension", () => {
  it("requests only the cookie permission and the ESPN Fantasy host", () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(["cookies"]);
    expect(manifest.host_permissions).toEqual(["https://fantasy.espn.com/*"]);
  });

  it("bridges only Sunday Games and explicit local development origins", () => {
    expect(manifest.content_scripts).toEqual([{
      matches: [
        "https://sundaygames.io/*",
        "http://localhost/*",
        "http://127.0.0.1/*",
      ],
      js: ["src/contentScript.js"],
      run_at: "document_start",
    }]);
  });

  it("does not use broad cookie enumeration", () => {
    const source = readFileSync("browser-extension/src/cookieSession.ts", "utf8");
    expect(source).toContain("cookies.get");
    expect(source).not.toContain("getAll");
  });
});
