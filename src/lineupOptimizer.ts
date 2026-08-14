import type { LineupEntry, MockRoster, Player } from "./types.js";

export type LineupMetric = "week1" | "weeks1To4" | "seasonProjection";

export const playerMetricValue = (player: Player, metric: LineupMetric): number => {
  if (metric === "seasonProjection") return player.seasonProjection ?? player.weeks1To4 * 4;
  return player[metric];
};

const byMetric = (metric: LineupMetric) => (a: Player, b: Player): number =>
  playerMetricValue(b, metric) - playerMetricValue(a, metric) ||
  a.price - b.price ||
  a.name.localeCompare(b.name);

export const optimizeLineup = (
  roster: MockRoster,
  metric: LineupMetric,
): LineupEntry[] => {
  const grouped = roster.players.reduce<Map<Player["position"], Player[]>>((map, player) => {
    const group = map.get(player.position) ?? [];
    group.push(player);
    map.set(player.position, group);
    return map;
  }, new Map());
  const sorted = (position: Player["position"]): Player[] =>
    [...(grouped.get(position) ?? [])].sort(byMetric(metric));

  const qb = sorted("QB");
  const rb = sorted("RB");
  const wr = sorted("WR");
  const te = sorted("TE");
  const k = sorted("K");
  const dst = sorted("DST");

  const [startingQb] = qb;
  const [startingRb1, startingRb2] = rb;
  const [startingWr1, startingWr2] = wr;
  const [startingTe] = te;
  const [startingKicker] = k;
  const [startingDefense] = dst;
  if (
    startingQb === undefined
    || startingRb1 === undefined
    || startingRb2 === undefined
    || startingWr1 === undefined
    || startingWr2 === undefined
    || startingTe === undefined
    || startingKicker === undefined
    || startingDefense === undefined
  ) {
    throw new Error("Roster cannot form a legal starting lineup.");
  }

  const lineup: LineupEntry[] = [
    { player: startingQb, slot: "QB" },
    { player: startingRb1, slot: "RB1" },
    { player: startingRb2, slot: "RB2" },
    { player: startingWr1, slot: "WR1" },
    { player: startingWr2, slot: "WR2" },
    { player: startingTe, slot: "TE" },
    { player: startingKicker, slot: "K" },
    { player: startingDefense, slot: "DST" },
  ];

  const used = new Set(lineup.map(entry => entry.player.name));
  const flex = roster.players
    .filter(player => ["RB", "WR", "TE"].includes(player.position) && !used.has(player.name))
    .sort(byMetric(metric))[0];

  if (!flex) throw new Error("Roster cannot fill FLEX.");
  lineup.push({ player: flex, slot: "FLEX" });
  return lineup;
};

export const lineupScore = (
  lineup: LineupEntry[],
  metric: LineupMetric,
): number => lineup.reduce((total, entry) => total + playerMetricValue(entry.player, metric), 0);
