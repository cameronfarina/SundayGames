import { cleanPlayerName, extract } from "../strategySupport.js";
import type { PairingParseResult } from "./contracts.js";

const pairingPattern = /\bpair(?:ed)?\s+with\s+([a-z][a-z.'-]*(?:\s+[a-z][a-z.'-]*){0,3})(?=\s+(?:and|for|by)\b|\s*$)/i;

export const parsePairing = (remainder: string): PairingParseResult => {
  const pairing = extract(remainder, pairingPattern);
  if (pairing === undefined) return { remainder, playerName: undefined };

  const playerName = cleanPlayerName(pairing.match[1] ?? "");
  if (playerName.length === 0) return { remainder, playerName: undefined };
  return { remainder: pairing.remainder, playerName };
};
