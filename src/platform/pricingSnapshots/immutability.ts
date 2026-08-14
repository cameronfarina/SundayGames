import type { PricingSnapshot } from "./contracts.js";

const freezeDeep = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
};

export const immutableSnapshot = (snapshot: PricingSnapshot): PricingSnapshot =>
  freezeDeep(structuredClone(snapshot));
