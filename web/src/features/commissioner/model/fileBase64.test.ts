import { afterEach, expect, it, vi } from "vitest";
import { fileBase64 } from "./fileBase64";

afterEach(() => vi.unstubAllGlobals());

it("encodes an uploaded file as base64", async () => {
  await expect(fileBase64(new File(["Cam,Puka"], "draft.csv")))
    .resolves.toBe("Q2FtLFB1a2E=");
});

it("rejects an unreadable file result", async () => {
  class InvalidFileReader {
    result: ArrayBuffer | string | null = null;
    private load: EventListener | null = null;
    addEventListener(type: string, listener: EventListener) { if (type === "load") this.load = listener; }
    readAsDataURL() { this.load?.(new Event("load")); }
  }
  vi.stubGlobal("FileReader", InvalidFileReader);
  await expect(fileBase64(new File(["x"], "draft.csv"))).rejects.toThrow("could not be read");
});

it("rejects a file reader error", async () => {
  class FailingFileReader {
    private error: EventListener | null = null;
    addEventListener(type: string, listener: EventListener) { if (type === "error") this.error = listener; }
    readAsDataURL() { this.error?.(new Event("error")); }
  }
  vi.stubGlobal("FileReader", FailingFileReader);
  await expect(fileBase64(new File(["x"], "draft.csv"))).rejects.toThrow("could not be read");
});
