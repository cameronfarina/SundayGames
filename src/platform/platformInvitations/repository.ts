import type {
  PlatformInvitationRecord,
  PlatformInvitationRepository,
} from "./contracts.js";
import { cloneRecord } from "./records.js";

export class InMemoryPlatformInvitationRepository
implements PlatformInvitationRepository {
  readonly #records = new Map<string, PlatformInvitationRecord>();

  savePending(invitation: PlatformInvitationRecord): PlatformInvitationRecord {
    if (invitation.kind === "league") {
      const pending = [...this.#records.values()].find(candidate =>
        candidate.kind === "league" &&
        candidate.seasonId === invitation.seasonId &&
        candidate.status === "pending");
      if (pending !== undefined) return cloneRecord(pending);
    }
    const stored = cloneRecord(invitation);
    this.#records.set(stored.id, stored);
    return cloneRecord(stored);
  }

  findById(invitationId: string): PlatformInvitationRecord | null {
    const record = this.#records.get(invitationId);
    return record === undefined ? null : cloneRecord(record);
  }

  findByTokenHash(tokenHash: string): PlatformInvitationRecord | null {
    const record = [...this.#records.values()]
      .find(candidate => candidate.tokenHash === tokenHash);
    return record === undefined ? null : cloneRecord(record);
  }

  listForSeason(seasonId: string): readonly PlatformInvitationRecord[] {
    return [...this.#records.values()]
      .filter(record => record.seasonId === seasonId)
      .map(cloneRecord);
  }

  accept(
    invitationId: string,
    accountId: string,
    acceptedAt: Date,
  ): PlatformInvitationRecord | null {
    const record = this.#records.get(invitationId);
    if (record === undefined || record.kind !== "team" || record.status !== "pending") {
      return null;
    }
    const accepted: PlatformInvitationRecord = {
      ...record,
      status: "accepted",
      acceptedByUserId: accountId,
      acceptedAt: new Date(acceptedAt),
    };
    this.#records.set(invitationId, accepted);
    return cloneRecord(accepted);
  }

  replacePending(
    invitationId: string,
    replacement: PlatformInvitationRecord,
    replacedAt: Date,
  ): PlatformInvitationRecord | null {
    const current = this.#records.get(invitationId);
    if (current === undefined || current.status !== "pending") {
      if (replacement.kind !== "league") return null;
      const pending = [...this.#records.values()].find(candidate =>
        candidate.kind === "league" &&
        candidate.seasonId === replacement.seasonId &&
        candidate.status === "pending");
      return pending === undefined ? null : cloneRecord(pending);
    }
    this.#records.set(invitationId, {
      ...current,
      status: "revoked",
      revokedAt: new Date(replacedAt),
    });
    const stored = cloneRecord(replacement);
    this.#records.set(stored.id, stored);
    return cloneRecord(stored);
  }

  revoke(invitationId: string, revokedAt: Date): PlatformInvitationRecord | null {
    const record = this.#records.get(invitationId);
    if (record === undefined || record.status !== "pending") return null;
    const revoked: PlatformInvitationRecord = {
      ...record,
      status: "revoked",
      revokedAt: new Date(revokedAt),
    };
    this.#records.set(invitationId, revoked);
    return cloneRecord(revoked);
  }
}
