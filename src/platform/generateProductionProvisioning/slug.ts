export const provisioningSlug = (value: string): string => {
  const slug = value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length === 0) throw new Error(`Cannot create a deterministic ID for "${value}".`);
  return slug;
};
