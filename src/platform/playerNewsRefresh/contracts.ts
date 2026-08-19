import type { FantasyProsClient } from "../../data/fantasyPros.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import type { PlayerNewsRepository } from "../playerNews.js";

export interface PlayerNewsRefreshDependencies {
  newsRepository: PlayerNewsRepository;
  /** Resolves the player a FantasyPros item names; RotoWire needs none of it. */
  fantasyProsRepository: FantasyProsRepository;
  /** Absent without an API key, which retires only the FantasyPros dataset. */
  fantasyProsClient?: FantasyProsClient | undefined;
}
