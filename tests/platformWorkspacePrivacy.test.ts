import { describe, expect, it } from "vitest";
import {
  authorizePrivatePrepArtifactMutation,
  authorizePrivatePrepArtifactRead,
  authorizeSharedLeagueResourceRead,
  authorizeSharedLeagueSetupMutation,
} from "../src/platform/workspacePrivacy.js";

const user = { id: "user_cam" };
const admin = { id: "user_admin" };
const rival = { id: "user_rival" };
const outsider = { id: "user_outsider" };

const leagueId = "league_home";
const otherLeagueId = "league_away";

const sharedLeagueResource = {
  id: "league-settings",
  leagueId,
  workspace: "shared",
  type: "league-settings",
} as const;

const privatePrepArtifact = {
  id: "draft-plan",
  leagueId,
  ownerUserId: user.id,
  workspace: "private-prep",
  type: "draft-plan",
} as const;

describe("workspace privacy authorization", () => {
  it("allows league members to read shared league resources in their league", () => {
    const decision = authorizeSharedLeagueResourceRead(user, sharedLeagueResource, [
      { userId: user.id, leagueId, role: "member" },
    ]);

    expect(decision).toEqual({ allowed: true });
  });

  it("denies shared league reads for users without membership in that league", () => {
    const decision = authorizeSharedLeagueResourceRead(outsider, sharedLeagueResource, [
      { userId: outsider.id, leagueId: otherLeagueId, role: "owner" },
    ]);

    expect(decision).toEqual({
      allowed: false,
      reason: "league_membership_required",
    });
  });

  it("allows only owners and admins to mutate shared setup", () => {
    const ownerDecision = authorizeSharedLeagueSetupMutation(user, sharedLeagueResource, [
      { userId: user.id, leagueId, role: "owner" },
    ]);
    const adminDecision = authorizeSharedLeagueSetupMutation(admin, sharedLeagueResource, [
      { userId: admin.id, leagueId, role: "admin" },
    ]);
    const memberDecision = authorizeSharedLeagueSetupMutation(user, sharedLeagueResource, [
      { userId: user.id, leagueId, role: "member" },
    ]);
    const observerDecision = authorizeSharedLeagueSetupMutation(rival, sharedLeagueResource, [
      { userId: rival.id, leagueId, role: "observer" },
    ]);

    expect(ownerDecision).toEqual({ allowed: true });
    expect(adminDecision).toEqual({ allowed: true });
    expect(memberDecision).toEqual({
      allowed: false,
      reason: "shared_setup_mutation_role_required",
    });
    expect(observerDecision).toEqual({
      allowed: false,
      reason: "shared_setup_mutation_role_required",
    });
  });

  it("allows users to read and mutate their own private prep artifacts", () => {
    const memberships = [{ userId: user.id, leagueId, role: "member" }] as const;

    expect(authorizePrivatePrepArtifactRead(user, privatePrepArtifact, memberships)).toEqual({ allowed: true });
    expect(authorizePrivatePrepArtifactMutation(user, privatePrepArtifact, memberships)).toEqual({ allowed: true });
  });

  it("denies same-league admins and members access to another user's private prep artifact", () => {
    const memberships = [
      { userId: admin.id, leagueId, role: "admin" },
      { userId: rival.id, leagueId, role: "member" },
    ] as const;

    expect(authorizePrivatePrepArtifactRead(admin, privatePrepArtifact, memberships)).toEqual({
      allowed: false,
      reason: "private_prep_owner_required",
    });
    expect(authorizePrivatePrepArtifactRead(rival, privatePrepArtifact, memberships)).toEqual({
      allowed: false,
      reason: "private_prep_owner_required",
    });
  });

  it("denies cross-league private prep access even when the user owns the artifact", () => {
    const crossLeagueArtifact = {
      ...privatePrepArtifact,
      leagueId: otherLeagueId,
    };

    const decision = authorizePrivatePrepArtifactRead(user, crossLeagueArtifact, [
      { userId: user.id, leagueId, role: "owner" },
    ]);

    expect(decision).toEqual({
      allowed: false,
      reason: "league_membership_required",
    });
  });
});
