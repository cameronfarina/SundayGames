import type { DraftStreamClient } from "./draftStreams.js";
import type { AuthenticatedLoadRequest } from "./httpBurst.js";
import type { PlatformLoadScenario } from "./scenario.js";

export type DraftMutationAction =
  | "start" | "pause" | "resume" | "reopen" | "sales"
  | "undo" | "corrections" | "end";

export interface DraftLoadMutation {
  readonly action: DraftMutationAction;
  readonly body: Readonly<object>;
  readonly sessionToken: string;
}

export interface PlatformLoadManifest {
  readonly drafts: readonly {
    readonly mutation: DraftLoadMutation;
    readonly roomId: string;
    readonly sessionTokens: readonly string[];
  }[];
  readonly newsSessionTokens: readonly string[];
  readonly simulationRequests: readonly {
    readonly body: Readonly<object>;
    readonly sessionToken: string;
  }[];
}

export interface PlatformLoadRequests {
  readonly draftClients: readonly DraftStreamClient[];
  readonly draftMutations: readonly (DraftLoadMutation & { readonly roomId: string })[];
  readonly newsRequests: readonly AuthenticatedLoadRequest[];
  readonly simulationRequests: readonly AuthenticatedLoadRequest[];
}

export const platformLoadRequestsFromManifest = (
  scenario: PlatformLoadScenario,
  manifest: PlatformLoadManifest,
): PlatformLoadRequests => {
  if (manifest.drafts.length !== scenario.leagueCount) {
    throw new Error(`Load manifest must contain exactly ${String(scenario.leagueCount)} leagues.`);
  }
  if (new Set(manifest.drafts.map(draft => draft.roomId)).size !== manifest.drafts.length) {
    throw new Error("Load manifest must contain distinct room IDs.");
  }
  if (manifest.drafts.some(draft => draft.sessionTokens.length !== scenario.draftClientsPerLeague)) {
    throw new Error(
      `Each load-test league must contain exactly ${String(scenario.draftClientsPerLeague)} sessions.`,
    );
  }
  if (manifest.drafts.some(draft => new Set(draft.sessionTokens).size !== draft.sessionTokens.length)) {
    throw new Error("Load manifest must contain distinct sessions within each league.");
  }
  if (manifest.drafts.some(draft => !draft.sessionTokens.includes(draft.mutation.sessionToken))) {
    throw new Error("Each league mutation session must be one of its connected sessions.");
  }
  if (manifest.newsSessionTokens.length === 0) {
    throw new Error("Load manifest must contain at least one news session.");
  }
  if (manifest.simulationRequests.length === 0) {
    throw new Error("Load manifest must contain at least one simulation request.");
  }
  if (new Set(manifest.simulationRequests.map(request => request.sessionToken)).size < 3) {
    throw new Error("Load manifest must contain at least three distinct simulation sessions.");
  }
  const repeated = function* <Value>(values: readonly Value[], count: number): Generator<Value> {
    let produced = 0;
    while (produced < count) {
      for (const value of values) {
        if (produced === count) return;
        yield value;
        produced += 1;
      }
    }
  };
  return {
    draftClients: manifest.drafts.flatMap(draft => draft.sessionTokens.map(sessionToken => ({
      roomId: draft.roomId,
      sessionToken,
    }))),
    draftMutations: manifest.drafts.map(draft => ({
      ...draft.mutation,
      roomId: draft.roomId,
    })),
    newsRequests: [...repeated(manifest.newsSessionTokens, scenario.newsReaders)].map(sessionToken => ({
      method: "GET",
      path: "/api/player-news",
      responseKind: "player-news",
      sessionToken,
    })),
    simulationRequests: [...repeated(manifest.simulationRequests, scenario.simulationRequests)]
      .map(request => ({
        body: request.body,
        method: "POST",
        path: "/season-simulations",
        responseKind: "season-simulation",
        sessionToken: request.sessionToken,
      })),
  };
};
