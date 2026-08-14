import type { LiveDraftStoreMutation } from "./contracts.js";
import { isObjectRecord } from "./valueGuards.js";

const numberProperty = (value: unknown, property: string): number | undefined => {
  if (!isObjectRecord(value)) return undefined;
  const candidate = value[property];
  return typeof candidate === "number" ? candidate : undefined;
};

export const parseMutation = (value: unknown): LiveDraftStoreMutation => {
  if (!isObjectRecord(value) || typeof value.type !== "string") return { type: "initialize" };
  if (value.type === "initialize") return { type: "initialize" };
  if (value.type === "sale" && typeof value.command === "string") {
    return { type: "sale", command: value.command };
  }
  if (value.type === "undo") {
    return typeof value.removedCommand === "string"
      ? { type: "undo", removedCommand: value.removedCommand }
      : { type: "undo" };
  }

  const previousCommandCount = numberProperty(value, "previousCommandCount");
  if (value.type === "reset" && previousCommandCount !== undefined) {
    return { type: "reset", previousCommandCount };
  }
  const importedCount = numberProperty(value, "importedCount");
  if (value.type === "import" && importedCount !== undefined && previousCommandCount !== undefined) {
    return { type: "import", importedCount, previousCommandCount };
  }
  return { type: "initialize" };
};
