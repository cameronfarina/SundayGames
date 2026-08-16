import { useState } from "react";
import { z } from "zod";

const watchedPlayersSchema = z.array(z.string());
const storageKey = (accountId: string): string => `mockd:player-news:my-players:${accountId}`;
const playerKey = (name: string): string => name.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");

const loadPlayers = (accountId: string): readonly string[] => {
  try {
    const saved = localStorage.getItem(storageKey(accountId));
    if (saved === null) return [];
    const parsed: unknown = JSON.parse(saved);
    const result = watchedPlayersSchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
};

const savePlayers = (accountId: string, players: readonly string[]): void => {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(players));
  } catch {
    // Following a player still works for this session when storage is unavailable.
  }
};

export const usePlayerNewsWatchlist = (accountId: string) => {
  const [players, setPlayers] = useState<readonly string[]>(() => loadPlayers(accountId));
  const followed = new Set(players.map(playerKey));
  const isFollowed = (player: string): boolean => followed.has(playerKey(player));
  const toggle = (player: string): void => {
    setPlayers(current => {
      const key = playerKey(player);
      const next = current.some(candidate => playerKey(candidate) === key)
        ? current.filter(candidate => playerKey(candidate) !== key)
        : [...current, player];
      savePlayers(accountId, next);
      return next;
    });
  };
  return { isFollowed, players, toggle };
};
