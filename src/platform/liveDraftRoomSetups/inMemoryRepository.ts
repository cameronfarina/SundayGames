import type {
  LiveDraftRoomSetup,
  LiveDraftRoomSetupRepository,
  SaveLiveDraftRoomSetupInput,
} from "./contracts.js";
import { LiveDraftRoomSetupWriteConflictError } from "./errors.js";
import { setupFor } from "./setup.js";

export class InMemoryLiveDraftRoomSetupRepository implements LiveDraftRoomSetupRepository {
  readonly #setups = new Map<string, LiveDraftRoomSetup>();

  setups(): readonly LiveDraftRoomSetup[] {
    return [...this.#setups.values()].map(setup => structuredClone(setup));
  }

  replaceSetups(setups: readonly LiveDraftRoomSetup[]): void {
    this.#setups.clear();
    for (const setup of setups) this.#setups.set(setup.seasonId, structuredClone(setup));
  }

  async findForSeason(seasonId: string): Promise<LiveDraftRoomSetup | null> {
    const setup = this.#setups.get(seasonId);
    return setup === undefined ? null : structuredClone(setup);
  }

  async save(
    input: SaveLiveDraftRoomSetupInput,
    options: { expectedContentHash?: string | null | undefined } = {},
  ): Promise<LiveDraftRoomSetup> {
    const setup = setupFor(input);
    const current = this.#setups.get(setup.seasonId);
    const expectedContentHash = options.expectedContentHash;
    if (
      (expectedContentHash === null && current !== undefined)
      || (typeof expectedContentHash === "string" && current?.contentHash !== expectedContentHash)
    ) throw new LiveDraftRoomSetupWriteConflictError();
    this.#setups.set(setup.seasonId, setup);
    return structuredClone(setup);
  }
}
