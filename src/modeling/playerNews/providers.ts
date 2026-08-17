import type { PlayerNewsProviderStatus } from "./feedContracts.js";

export const playerNewsProviderStatuses = (
  localEvidencePath: string,
): PlayerNewsProviderStatus[] => [
  {
    key: "local-evidence",
    label: "Local evidence",
    status: "active",
    detail: localEvidencePath,
  },
  {
    key: "rotowire-rss",
    label: "RotoWire RSS",
    status: "available",
    detail: "No-key NFL RSS feed with recent player news headlines.",
  },
  {
    key: "espn",
    label: "ESPN",
    status: "available",
    detail: "No-key NFL news feed with breaking headlines and player tags.",
  },
  {
    key: "sleeper",
    label: "Sleeper",
    status: "candidate",
    detail: "Free player metadata, injury statuses, and add/drop trends.",
  },
  {
    key: "sportsdataio",
    label: "SportsDataIO",
    status: "candidate",
    detail: "Licensed player news, injuries, depth charts, and practice reports.",
  },
  {
    key: "rotoballer",
    label: "RotoBaller",
    status: "candidate",
    detail: "Commercial fantasy player-news XML/RSS/JSON feeds.",
  },
  {
    key: "rotowire",
    label: "RotoWire licensed",
    status: "candidate",
    detail: "Commercial RotoWire data access through direct or brokered integrations.",
  },
];
