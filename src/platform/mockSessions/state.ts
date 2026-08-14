import type { MockDraftSessionResourcePolicy } from "./resourcePolicy.js";
import type { MockDraftSession } from "./session.js";

export interface MockDraftSessionRepositoryState {
  readonly sessionsById: Map<string, MockDraftSession>;
  readonly resourcePolicy: MockDraftSessionResourcePolicy;
}
