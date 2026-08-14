import { randomBytes } from "node:crypto";
import type {
  PlatformInvitationRecord,
  PlatformInvitationRepository,
} from "../platformInvitations.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { acceptInvitation } from "./accept.js";
import type { PostgresPlatformInvitationRepositoryOptions } from "./contracts.js";
import {
  findInvitationByIdRow,
  findInvitationByTokenHashRow,
  listInvitationRows,
} from "./reads.js";
import { replacePendingInvitation } from "./replacePending.js";
import { revokeInvitation } from "./revoke.js";
import { invitationForRow } from "./rowCodec.js";
import { savePendingInvitation } from "./savePending.js";
import { platformInvitationSchemaStatements } from "./schema.js";

const createMembershipId = (): string =>
  `membership_${randomBytes(12).toString("base64url")}`;

export class PostgresPlatformInvitationRepository implements PlatformInvitationRepository {
  readonly #membershipIdFactory: () => string;

  constructor(
    private readonly client: PostgresTransactionalQueryClient,
    options: PostgresPlatformInvitationRepositoryOptions = {},
  ) {
    this.#membershipIdFactory = options.membershipIdFactory ?? createMembershipId;
  }

  static async initializeSchema(client: PostgresQueryClient): Promise<void> {
    for (const statement of platformInvitationSchemaStatements) await client.query(statement);
  }

  async savePending(invitation: PlatformInvitationRecord): Promise<PlatformInvitationRecord> {
    return await savePendingInvitation(this.client, invitation);
  }

  async findById(invitationId: string): Promise<PlatformInvitationRecord | null> {
    const row = await findInvitationByIdRow(this.client, invitationId);
    return row === undefined ? null : invitationForRow(row);
  }

  async findByTokenHash(tokenHash: string): Promise<PlatformInvitationRecord | null> {
    const row = await findInvitationByTokenHashRow(this.client, tokenHash);
    return row === undefined ? null : invitationForRow(row);
  }

  async listForSeason(seasonId: string): Promise<readonly PlatformInvitationRecord[]> {
    return (await listInvitationRows(this.client, seasonId)).map(invitationForRow);
  }

  async accept(
    invitationId: string,
    accountId: string,
    acceptedAt: Date,
  ): Promise<PlatformInvitationRecord | null> {
    return await this.client.transaction(async client =>
      await acceptInvitation(
        client,
        invitationId,
        accountId,
        acceptedAt,
        this.#membershipIdFactory,
      )
    );
  }

  async replacePending(
    invitationId: string,
    replacement: PlatformInvitationRecord,
    replacedAt: Date,
  ): Promise<PlatformInvitationRecord | null> {
    return await this.client.transaction(async client =>
      await replacePendingInvitation(client, invitationId, replacement, replacedAt)
    );
  }

  async revoke(invitationId: string, revokedAt: Date): Promise<PlatformInvitationRecord | null> {
    return await revokeInvitation(this.client, invitationId, revokedAt);
  }
}
