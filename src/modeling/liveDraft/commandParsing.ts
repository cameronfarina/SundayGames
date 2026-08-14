import { ownerOrder, type Owner } from "../../../config/league.js";
import { cleanPlayerName } from "../../data/normalizePlayerName.js";
import type { ParsedLiveDraftSaleCommand } from "./contracts.js";

export const parseLiveDraftSaleCommand = (input: string): ParsedLiveDraftSaleCommand => {
  const cleaned = input.trim().replace(/\s+/g, " ");
  const salePattern = /^(.+?)\s+(?:drafted|bought|won|got|took)\s+(.+?)\s+(?:for|at|@)\s+\$?(\d+)$/i;
  const compactPattern = /^(\S+)\s+(.+?)\s+\$?(\d+)$/i;
  const match = cleaned.match(salePattern) ?? cleaned.match(compactPattern);

  if (!match) {
    throw new Error(`Could not parse live draft sale command: "${input}".`);
  }

  const [, ownerText = "", playerText = "", priceText = ""] = match;
  const price = Number(priceText);
  if (!Number.isInteger(price) || price <= 0) {
    throw new Error(`Sale price must be a positive whole dollar amount: "${input}".`);
  }

  return { ownerText, playerText: cleanPlayerName(playerText), price };
};

export const ownerForText = (ownerText: string): Owner => {
  const key = ownerText.toLowerCase();
  const owner = ownerOrder.find(candidate => candidate.toLowerCase() === key);
  if (!owner) throw new Error(`Unknown owner "${ownerText}". Use one of: ${ownerOrder.join(", ")}.`);
  return owner;
};
