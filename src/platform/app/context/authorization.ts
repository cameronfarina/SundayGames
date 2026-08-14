import type { WorkspaceRole } from "../../workspacePrivacy.js";

const sharedMutationRoles = new Set<WorkspaceRole>(["owner", "admin"]);

export const canMutateLeague = (role: WorkspaceRole): boolean => sharedMutationRoles.has(role);
