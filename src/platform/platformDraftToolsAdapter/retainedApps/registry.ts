import type { DraftToolsRuntime } from "../runtime.js";
import { draftToolsScopeKey } from "../scope.js";
import { disposeDraftToolsApp } from "../serverLifecycle.js";
import type { AcquiredDraftToolsApp, RetainedDraftToolsApp } from "./contracts.js";
import { createScopedDraftToolsApp } from "./createApp.js";
import { disposableDraftToolsApps } from "./disposable.js";

export class DraftToolsAppRegistry {
  readonly entries = new Map<string, RetainedDraftToolsApp>();
  private closed = false;

  constructor(private readonly runtime: DraftToolsRuntime) {}

  isClosed(): boolean {
    return this.closed;
  }

  async acquire(accountId: string, seasonId: string): Promise<AcquiredDraftToolsApp> {
    const key = draftToolsScopeKey(accountId, seasonId);
    const currentTime = this.runtime.now();
    let entry = this.entries.get(key);
    if (entry === undefined) {
      await this.prune(currentTime, this.runtime.maxRetainedApps - 1);
      if (this.closed) throw new Error("Draft tools adapter is unavailable.");
      entry = this.entries.get(key);
      if (entry === undefined) entry = this.createEntry(accountId, seasonId, currentTime);
      else this.touch(entry, currentTime);
    } else {
      this.touch(entry, currentTime);
    }

    try {
      return { app: await entry.appPromise, entry };
    } catch (error) {
      entry.activeRequests -= 1;
      throw error;
    }
  }

  release(entry: RetainedDraftToolsApp): void {
    entry.activeRequests = Math.max(0, entry.activeRequests - 1);
    entry.lastUsedAt = this.runtime.now();
    void this.prune(entry.lastUsedAt, this.runtime.maxRetainedApps).catch(() => undefined);
  }

  async clearAccount(accountId: string): Promise<void> {
    const entries = [...this.entries.values()].filter(entry => entry.accountId === accountId);
    await Promise.all(entries.map(entry => this.disposeEntry(entry)));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const entries = [...this.entries.values()];
    this.entries.clear();
    await Promise.all(entries.map(entry => this.disposeEntry(entry)));
  }

  private createEntry(
    accountId: string,
    seasonId: string,
    currentTime: number,
  ): RetainedDraftToolsApp {
    if (this.entries.size >= this.runtime.maxRetainedApps) {
      throw new Error("Draft tools adapter is at capacity.");
    }
    const key = draftToolsScopeKey(accountId, seasonId);
    let entry: RetainedDraftToolsApp;
    const appPromise = Promise.resolve().then(() =>
      createScopedDraftToolsApp(this.runtime, accountId, seasonId)
    );
    entry = { accountId, activeRequests: 1, appPromise, key, lastUsedAt: currentTime };
    this.entries.set(key, entry);
    void appPromise.catch(() => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
    });
    return entry;
  }

  private touch(entry: RetainedDraftToolsApp, currentTime: number): void {
    entry.activeRequests += 1;
    entry.lastUsedAt = currentTime;
  }

  private async prune(currentTime: number, targetSize: number): Promise<void> {
    const disposable = await disposableDraftToolsApps(this.entries.values());
    const expired = disposable.filter(
      entry => currentTime - entry.lastUsedAt >= this.runtime.idleTimeoutMs,
    );
    for (const entry of expired) await this.disposeEntry(entry);
    for (const entry of disposable) {
      if (this.entries.size <= targetSize) break;
      if (this.entries.has(entry.key)) await this.disposeEntry(entry);
    }
  }

  private async disposeEntry(entry: RetainedDraftToolsApp): Promise<void> {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
    try {
      await disposeDraftToolsApp(await entry.appPromise);
    } catch {
      // Failed initialization has no reusable server state to retain.
    }
  }
}
