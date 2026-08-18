interface OwnerMappedItem { readonly ownerMappings: Readonly<Record<string, string | undefined>> }
interface OwnerAuditedRow {
  readonly blockers: readonly { readonly code: string }[];
  readonly identityAudit?: { readonly sourceOwnerOrTeamLabel: string } | undefined;
}

export const historicalOwnerNeeds = (
  item: OwnerMappedItem,
  rows: readonly OwnerAuditedRow[],
): readonly string[] => [...new Set(rows.flatMap(row => {
  const needsMapping = row.blockers.some(blocker =>
    blocker.code === "owner_unknown" || blocker.code === "owner_ambiguous");
  return needsMapping && row.identityAudit !== undefined
    ? [row.identityAudit.sourceOwnerOrTeamLabel]
    : [];
}))].filter(label => item.ownerMappings[label] === undefined);
