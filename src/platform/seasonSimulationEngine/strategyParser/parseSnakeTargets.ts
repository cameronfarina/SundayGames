import { cleanPlayerName, extract } from "../strategySupport.js";
import type { TargetCandidate } from "./contracts.js";

const snakeRoundTargetPattern = /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:by|no\s+later\s+than)\s+round\s+(\d+)\b/i;
const snakePickTargetPattern = /\b(?:draft|target)\s+([a-z][a-z.'-]*(?:\s+(?!(?:and\s+)?(?:draft|target)\b)[a-z0-9][a-z0-9.'-]*){0,4}?)\s+(?:by|no\s+later\s+than)\s+(?:overall\s+)?pick\s+(\d+)\b/i;

const parseSnakeConstraint = (
  initialRemainder: string,
  pattern: RegExp,
  candidates: TargetCandidate[],
  constraintFor: (value: number) => { maxSnakeRound: number } | { maxSnakeOverallPick: number },
): string => {
  let remainder = initialRemainder;
  while (true) {
    const target = extract(remainder, pattern);
    if (target === undefined) return remainder;
    const playerName = cleanPlayerName(target.match[1] ?? "");
    const maximum = Number(target.match[2]);
    if (playerName.length > 0 && Number.isSafeInteger(maximum) && maximum > 0) {
      candidates.push({
        index: target.index,
        target: { playerName, ...constraintFor(maximum) },
      });
    }
    remainder = target.remainder;
  }
};

export const parseSnakeTargets = (
  remainder: string,
  candidates: TargetCandidate[],
): string => parseSnakeConstraint(
  parseSnakeConstraint(
    remainder,
    snakeRoundTargetPattern,
    candidates,
    maxSnakeRound => ({ maxSnakeRound }),
  ),
  snakePickTargetPattern,
  candidates,
  maxSnakeOverallPick => ({ maxSnakeOverallPick }),
);
