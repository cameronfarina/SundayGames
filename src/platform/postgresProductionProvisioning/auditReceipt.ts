import type {
  ProductionProvisioningContext,
  ProductionProvisioningInspection,
  ResolvedProductionProvisioningDocument,
} from "../productionProvisioning.js";
import type { ProductionProvisioningDependencies } from "./contracts.js";

export const assertReadyForAudit = (inspection: ProductionProvisioningInspection): void => {
  const incomplete = inspection.changes.filter(candidate =>
    candidate.resourceType !== "audit-event" && candidate.action !== "unchanged"
  );
  if (inspection.conflicts.length === 0 && incomplete.length === 0) return;
  const issues = [
    ...inspection.conflicts,
    ...incomplete.map(candidate =>
      `${candidate.resourceType} ${candidate.resourceId} still requires ${candidate.action}.`
    ),
  ];
  throw new Error(`Production provisioning could not record its audit event:\n- ${issues.join("\n- ")}`);
};

export const recordAuditReceipt = async (
  document: ResolvedProductionProvisioningDocument,
  context: ProductionProvisioningContext,
  dependencies: ProductionProvisioningDependencies,
): Promise<void> => {
  await dependencies.client.query(`
INSERT INTO audit_events (
  id, league_id, user_id, event_type, resource_type, resource_id,
  metadata_json, created_at
) VALUES ($1, $2, $3, 'production_provisioning_applied', 'league_season', $4, $5::jsonb, $6)
ON CONFLICT (id) DO NOTHING;
`.trim(), [
    context.auditEventId,
    document.league.id,
    document.actorAccountId,
    document.season.id,
    JSON.stringify({
      schemaVersion: document.schemaVersion,
      provisioningId: document.provisioningId,
      inputDigest: context.inputDigest,
      accountCount: document.accounts.length,
      membershipCount: document.memberships.length,
      teamCount: document.season.teams.length,
      catalogCount: document.catalog.length,
      initialRosterCount: document.initialRosters.length,
      keeperCount: document.keepers.length,
    }),
    context.now,
  ]);
};
