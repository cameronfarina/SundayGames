const slugCharacters = /[^a-z0-9]+/gu;
const surroundingHyphens = /^-+|-+$/gu;

export const leagueSlugBase = (name: string): string => {
  const slug = name.trim().toLowerCase()
    .replace(slugCharacters, "-")
    .replace(surroundingHyphens, "");
  return slug.length === 0 ? "league" : slug;
};
