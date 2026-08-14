import type { PracticeShortlistItem } from "../api/practiceContextSchema";

export const formText = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};

const sentence = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || /[.!?]$/u.test(trimmed)) return trimmed;
  return `${trimmed}.`;
};

export const simulationStrategyText = (
  targets: readonly PracticeShortlistItem[],
  additionalInstructions: string,
): string => [
  ...targets.map(target => sentence(
    target.maxBid === undefined
      ? `Draft ${target.playerName}`
      : `Draft ${target.playerName} for no more than $${String(target.maxBid)}`,
  )),
  sentence(additionalInstructions),
].filter(part => part.length > 0).join(" ");
