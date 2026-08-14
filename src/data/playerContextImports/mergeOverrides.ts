import type { PlayerContextOverride } from "../../../config/playerContext.js";
import { normalizePlayerName } from "../normalizePlayerName.js";

export const mergePlayerContextOverrides = (
  baseOverrides: readonly PlayerContextOverride[],
  importedOverrides: readonly PlayerContextOverride[],
): PlayerContextOverride[] => {
  const byName = new Map<string, PlayerContextOverride>();
  for (const override of [...baseOverrides, ...importedOverrides]) {
    const key = normalizePlayerName(override.player);
    const existing = byName.get(key);
    const notes = { ...existing?.notes, ...override.notes };
    const evidence = [...(existing?.evidence ?? []), ...(override.evidence ?? [])];
    byName.set(key, {
      player: override.player,
      signals: { ...existing?.signals, ...override.signals },
      ...(Object.keys(notes).length > 0 ? { notes } : {}),
      ...(evidence.length > 0 ? { evidence } : {}),
    });
  }
  return [...byName.values()];
};
