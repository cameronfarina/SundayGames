const generationalSuffixPattern = /,?\s+(?:jr|sr|ii|iii|iv|v)\.?$/i;

export const cleanPlayerName = (name: string): string =>
  name.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const withoutGenerationalSuffix = (name: string): string =>
  cleanPlayerName(name).replace(generationalSuffixPattern, "").trim();

const playerIdentityKey = (name: string): string =>
  withoutGenerationalSuffix(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const canonicalNameAliases: readonly (readonly [string, string])[] = [
  ["Aaron Jones Sr.", "Aaron Jones"],
  ["Brian Thomas Jr.", "Brian Thomas"],
  ["Brian Robinson Jr.", "Brian Robinson"],
  ["Chris Rodriguez Jr.", "Chris Rodriguez"],
  ["Deebo Samuel Sr.", "Deebo Samuel"],
  ["Devon Achane", "De'Von Achane"],
  ["D.J. Moore", "DJ Moore"],
  ["DJ Chark Jr.", "DJ Chark"],
  ["Hollywood Brown", "Marquise Brown"],
  ["J.K. Dobbins", "JK Dobbins"],
  ["Marvin Mims Jr.", "Marvin Mims"],
  ["Michael Pittman Jr.", "Michael Pittman"],
  ["Odell Beckham Jr.", "Odell Beckham"],
  ["Patrick Mahomes II", "Patrick Mahomes"],
  ["Travis Etienne Jr.", "Travis Etienne"],
];

const canonicalNameByAlias = new Map<string, string>(
  canonicalNameAliases.map(([alias, canonicalName]) => [playerIdentityKey(alias), canonicalName]),
);

export const normalizePlayerName = (name: string): string => {
  const cleaned = cleanPlayerName(name);
  return canonicalNameByAlias.get(playerIdentityKey(cleaned)) ?? withoutGenerationalSuffix(cleaned);
};

export const canonicalPlayerIdentityKey = (name: string): string =>
  playerIdentityKey(normalizePlayerName(name));
