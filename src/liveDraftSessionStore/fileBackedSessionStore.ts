import type {
  FileBackedLiveDraftSessionStoreOptions,
  LiveDraftSessionPaths,
  LiveDraftSessionStatus,
  LiveDraftStoreMutation,
} from "./contracts.js";
import { persistSession } from "./sessionPersistence.js";
import { createSessionPaths } from "./sessionPaths.js";
import { recoverSessionSnapshot } from "./sessionRecovery.js";
import { validateCommandList } from "./valueGuards.js";

export class FileBackedLiveDraftSessionStore {
  readonly paths: LiveDraftSessionPaths;

  private commands: string[] = [];
  private loadedAt: string | undefined;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(options: FileBackedLiveDraftSessionStoreOptions = {}) {
    this.paths = createSessionPaths(options.directory);
  }

  currentCommands(): string[] {
    return [...this.commands];
  }

  status(): LiveDraftSessionStatus {
    return {
      commandCount: this.commands.length,
      paths: this.paths,
      ...(this.loadedAt === undefined ? {} : { loadedAt: this.loadedAt }),
    };
  }

  async load(): Promise<string[]> {
    const snapshot = await recoverSessionSnapshot(this.paths);
    if (!snapshot) return this.persist({ type: "initialize" }, []);
    this.commands = [...snapshot.commands];
    this.loadedAt = new Date().toISOString();
    return this.currentCommands();
  }

  async appendCommand(command: string): Promise<string[]> {
    const trimmed = command.trim();
    if (!trimmed) throw new Error("Command is required.");
    return this.enqueueMutation(() =>
      this.persist({ type: "sale", command: trimmed }, [...this.commands, trimmed]),
    );
  }

  async undo(): Promise<string[]> {
    return this.enqueueMutation(() => {
      const removedCommand = this.commands.at(-1);
      const mutation: LiveDraftStoreMutation = removedCommand === undefined
        ? { type: "undo" }
        : { type: "undo", removedCommand };
      return this.persist(mutation, this.commands.slice(0, -1));
    });
  }

  async reset(): Promise<string[]> {
    return this.enqueueMutation(() =>
      this.persist({ type: "reset", previousCommandCount: this.commands.length }, []),
    );
  }

  async importCommands(commands: readonly string[]): Promise<string[]> {
    const nextCommands = validateCommandList([...commands]);
    return this.enqueueMutation(() => this.persist({
      type: "import",
      importedCount: nextCommands.length,
      previousCommandCount: this.commands.length,
    }, nextCommands));
  }

  private enqueueMutation<T>(mutation: () => Promise<T>): Promise<T> {
    const queued = this.mutationQueue.then(mutation, mutation);
    this.mutationQueue = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  private async persist(
    mutation: LiveDraftStoreMutation,
    nextCommands: readonly string[],
  ): Promise<string[]> {
    const timestamp = await persistSession(this.paths, mutation, nextCommands);
    this.commands = [...nextCommands];
    this.loadedAt = timestamp;
    return this.currentCommands();
  }
}
