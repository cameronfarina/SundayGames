import { describe, expect, it, vi } from "vitest";
import {
  runPlatformWebMain,
  runPlatformWebProcess,
  type PlatformWebProcessHost,
  type PlatformWebProcessLogger,
} from "../src/platform/startPlatformWeb/processEntrypoint.js";

const hostWith = (
  listeners: Map<NodeJS.Signals, () => void>,
  exit: (code: number) => void,
): PlatformWebProcessHost => ({
  once: (signal, listener) => { listeners.set(signal, listener); },
  exit,
});

const capturingLogger = (messages: string[]): PlatformWebProcessLogger => ({
  log: message => { messages.push(message); },
  error: message => { messages.push(message); },
});

describe("platform web process entrypoint", () => {
  it("logs startup and closes cleanly on termination", async () => {
    const listeners = new Map<NodeJS.Signals, () => void>();
    const messages: string[] = [];
    const close = vi.fn(async () => undefined);
    const exit = vi.fn();

    await runPlatformWebProcess(
      async () => ({ server: { host: "127.0.0.1", port: 4321 }, close }),
      hostWith(listeners, exit),
      capturingLogger(messages),
    );
    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      event: "platform_started",
      host: "127.0.0.1",
      port: 4321,
    });

    const terminate = listeners.get("SIGTERM");
    if (terminate === undefined) throw new Error("Expected SIGTERM listener.");
    terminate();
    await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it("logs a sanitized startup failure and exits nonzero", async () => {
    const messages: string[] = [];
    const exit = vi.fn();

    await runPlatformWebMain(
      async () => { throw new Error("private startup details"); },
      hostWith(new Map(), exit),
      capturingLogger(messages),
    );

    expect(messages).toHaveLength(1);
    expect(JSON.parse(messages[0] ?? "{}")).toMatchObject({
      event: "platform_startup_failed",
      errorCode: "startup_failed",
    });
    expect(messages[0]).not.toContain("private startup details");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
