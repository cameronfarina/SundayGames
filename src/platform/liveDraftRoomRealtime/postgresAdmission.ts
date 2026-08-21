import { randomUUID } from "node:crypto";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import {
  defaultLiveDraftRoomConcurrentWaiters,
  defaultLiveDraftRoomConcurrentWaitersPerAccount,
  defaultLiveDraftRoomWaitRetryAfterSeconds,
  LiveDraftRoomWaitLimitError,
  requirePositiveSafeInteger,
} from "./limits.js";

const admissionLockKey = "sunday-games:live-draft-stream-admission";
const defaultLeaseTtlMilliseconds = 60_000;
const defaultLeaseRenewalMilliseconds = 30_000;
interface AdmissionCountRow {
  global_count: number;
  account_count: number;
}

export interface PostgresLiveDraftRoomStreamAdmissionOptions {
  maxConcurrentWaitersPerAccount?: number | undefined;
  maxConcurrentWaiters?: number | undefined;
  retryAfterSeconds?: number | undefined;
  leaseTtlMilliseconds?: number | undefined;
  leaseRenewalMilliseconds?: number | undefined;
  now?: (() => Date) | undefined;
  idFactory?: (() => string) | undefined;
}

export interface LiveDraftRoomStreamPermit {
  renew(): Promise<void>;
  release(): Promise<void>;
}

const countsFor = async (
  client: PostgresQueryClient,
  accountId: string,
  now: Date,
): Promise<AdmissionCountRow> => {
  const result = await client.query<AdmissionCountRow>(
    `SELECT
  COUNT(*)::integer AS global_count,
  COUNT(*) FILTER (WHERE account_id = $1)::integer AS account_count
FROM live_draft_stream_leases
WHERE expires_at > $2`,
    [accountId, now],
  );
  return result.rows[0] ?? { global_count: 0, account_count: 0 };
};

export class PostgresLiveDraftRoomStreamAdmission {
  readonly #maxConcurrentWaitersPerAccount: number;
  readonly #maxConcurrentWaiters: number;
  readonly #retryAfterSeconds: number;
  readonly #leaseTtlMilliseconds: number;
  readonly #leaseRenewalMilliseconds: number;
  readonly #now: () => Date;
  readonly #idFactory: () => string;

  constructor(
    readonly client: PostgresTransactionalQueryClient,
    options: PostgresLiveDraftRoomStreamAdmissionOptions = {},
  ) {
    this.#maxConcurrentWaitersPerAccount = requirePositiveSafeInteger(
      options.maxConcurrentWaitersPerAccount ?? defaultLiveDraftRoomConcurrentWaitersPerAccount,
      "maxConcurrentWaitersPerAccount",
    );
    this.#maxConcurrentWaiters = requirePositiveSafeInteger(
      options.maxConcurrentWaiters ?? defaultLiveDraftRoomConcurrentWaiters,
      "maxConcurrentWaiters",
    );
    this.#retryAfterSeconds = requirePositiveSafeInteger(
      options.retryAfterSeconds ?? defaultLiveDraftRoomWaitRetryAfterSeconds,
      "retryAfterSeconds",
    );
    this.#leaseTtlMilliseconds = requirePositiveSafeInteger(
      options.leaseTtlMilliseconds ?? defaultLeaseTtlMilliseconds,
      "leaseTtlMilliseconds",
    );
    this.#leaseRenewalMilliseconds = requirePositiveSafeInteger(
      options.leaseRenewalMilliseconds ?? defaultLeaseRenewalMilliseconds,
      "leaseRenewalMilliseconds",
    );
    if (this.#leaseRenewalMilliseconds >= this.#leaseTtlMilliseconds) {
      throw new RangeError("leaseRenewalMilliseconds must be shorter than leaseTtlMilliseconds.");
    }
    this.#now = options.now ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async acquire(input: { accountId: string; roomId: string }): Promise<LiveDraftRoomStreamPermit> {
    const leaseId = this.#idFactory();
    const acquiredAt = this.#now();
    await this.client.transaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
        admissionLockKey,
      ]);
      await client.query("DELETE FROM live_draft_stream_leases WHERE expires_at <= $1", [
        acquiredAt,
      ]);
      const counts = await countsFor(client, input.accountId, acquiredAt);
      if (counts.account_count >= this.#maxConcurrentWaitersPerAccount) {
        throw new LiveDraftRoomWaitLimitError("account", this.#retryAfterSeconds);
      }
      if (counts.global_count >= this.#maxConcurrentWaiters) {
        throw new LiveDraftRoomWaitLimitError("global", this.#retryAfterSeconds);
      }
      await client.query(
        `INSERT INTO live_draft_stream_leases (
  id, account_id, draft_room_id, expires_at, created_at
) VALUES ($1, $2, $3, $4, $5)`,
        [
          leaseId,
          input.accountId,
          input.roomId,
          new Date(acquiredAt.getTime() + this.#leaseTtlMilliseconds),
          acquiredAt,
        ],
      );
    });

    let released = false;
    let renewAfter = acquiredAt.getTime() + this.#leaseRenewalMilliseconds;
    return {
      renew: async () => {
        if (released) return;
        const now = this.#now();
        if (now.getTime() < renewAfter) return;
        const result = await this.client.query<{ id: string }>(
          `UPDATE live_draft_stream_leases
SET expires_at = $2
WHERE id = $1
  AND expires_at > $3
RETURNING id`,
          [leaseId, new Date(now.getTime() + this.#leaseTtlMilliseconds), now],
        );
        if (result.rows[0] === undefined) {
          throw new Error("Live draft stream admission lease expired.");
        }
        renewAfter = now.getTime() + this.#leaseRenewalMilliseconds;
      },
      release: async () => {
        if (released) return;
        released = true;
        await this.client.query("DELETE FROM live_draft_stream_leases WHERE id = $1", [leaseId]);
      },
    };
  }
}
