import type { ParsedKeeperCommand } from "./internalTypes.js";
import type { KeeperCommandErrorResult } from "./types.js";

const invalidFormat = (): KeeperCommandErrorResult => ({
  kind: "error",
  error: {
    code: "invalid_format",
    message: "Use '<team or manager> keeping <player> <number>'.",
  },
});

export const parseCommand = (
  command: string,
): ParsedKeeperCommand | KeeperCommandErrorResult => {
  const sourceCommand = command.trim().replace(/\s+/gu, " ");
  const match = /^(.*?)\s+keeping\s+(.+?)\s+(\S+)$/iu.exec(sourceCommand);
  if (match === null) return invalidFormat();

  const teamMention = match[1]?.trim() ?? "";
  const playerMention = match[2]?.trim() ?? "";
  const rawValue = match[3] ?? "";
  if (teamMention.length === 0 || playerMention.length === 0) return invalidFormat();

  if (!/^\d+$/u.test(rawValue)) {
    return {
      kind: "error",
      error: {
        code: "invalid_value",
        message: `Keeper value "${rawValue}" must be a whole number.`,
        mention: rawValue,
      },
    };
  }

  return {
    sourceCommand,
    teamMention,
    playerMention,
    rawTrailingValue: rawValue,
    trailingValue: Number(rawValue),
  };
};
