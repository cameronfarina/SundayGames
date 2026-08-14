import type { PracticeShortlistItem } from "../api/practiceContextSchema";
import { playerKey } from "./playerBoard";

export const replaceShortlistTarget = (
  items: readonly PracticeShortlistItem[] | undefined,
  target: PracticeShortlistItem,
): readonly PracticeShortlistItem[] => [
  ...(items ?? []).filter(item => playerKey(item.playerName) !== playerKey(target.playerName)),
  target,
];

export const removeShortlistTarget = (
  items: readonly PracticeShortlistItem[] | undefined,
  playerName: string,
): readonly PracticeShortlistItem[] => (items ?? [])
  .filter(item => playerKey(item.playerName) !== playerKey(playerName));
