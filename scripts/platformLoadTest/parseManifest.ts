import type { DraftMutationAction, PlatformLoadManifest } from "./manifest.js";

export const platformLoadManifestFrom = (
  value: unknown,
): PlatformLoadManifest => {
  const invalid = (): never => {
    throw new Error("Invalid platform load-test manifest.");
  };
  const nonemptyString = (candidate: unknown): string => {
    if (typeof candidate !== "string" || candidate === "") return invalid();
    return candidate;
  };
  const mutationAction = (candidate: unknown): DraftMutationAction => {
    switch (candidate) {
      case "start": case "pause": case "resume": case "reopen":
      case "sales": case "undo": case "corrections": case "end":
        return candidate;
      default:
        return invalid();
    }
  };
  const objectFrom = (candidate: unknown): object => {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return invalid();
    return candidate;
  };
  const propertyOf = (candidate: object, key: string): unknown =>
    Object.getOwnPropertyDescriptor(candidate, key)?.value;
  const arrayFrom = (candidate: unknown): unknown[] => {
    if (!Array.isArray(candidate)) return invalid();
    return candidate;
  };
  const stringArrayFrom = (candidate: unknown): string[] =>
    arrayFrom(candidate).map(nonemptyString);
  const manifest = objectFrom(value);
  const draftValues = arrayFrom(propertyOf(manifest, "drafts"));
  const newsSessionTokens = stringArrayFrom(propertyOf(manifest, "newsSessionTokens"));
  const simulationValues = arrayFrom(propertyOf(manifest, "simulationRequests"));
  const drafts = draftValues.map(draft => {
    const item = objectFrom(draft);
    const mutationValue = objectFrom(propertyOf(item, "mutation"));
    return {
      mutation: {
        action: mutationAction(propertyOf(mutationValue, "action")),
        body: objectFrom(propertyOf(mutationValue, "body")),
        sessionToken: nonemptyString(propertyOf(mutationValue, "sessionToken")),
      },
      roomId: nonemptyString(propertyOf(item, "roomId")),
      sessionTokens: stringArrayFrom(propertyOf(item, "sessionTokens")),
    };
  });
  const simulationRequests = simulationValues.map(simulation => {
    const item = objectFrom(simulation);
    return {
      body: objectFrom(propertyOf(item, "body")),
      sessionToken: nonemptyString(propertyOf(item, "sessionToken")),
    };
  });
  return {
    drafts,
    newsSessionTokens,
    simulationRequests,
  };
};
