# Render Production Launch

This is the concrete first-production procedure for Mockd. The broader architecture and go/no-go rules remain in the [production runbook](./ai-plans/fantasy-draft-platform/production-runbook.md).

## What The Blueprint Creates

`render.yaml` creates these resources in Render's Virginia region:

- `sundaygames`: one paid Docker web instance with `/readyz` health checks and no persistent disk.
- `mockd-postgres`: private managed Postgres 17 on a paid plan with 15 GB of autoscaling storage.

The web service runs migrations before a release. The migration runner holds a Postgres advisory lock before any DDL. Render deploys automatically once GitHub checks pass; an operator can still deploy sooner by hand for urgent low-risk changes. The server prepares and authorizes league-aware simulation inputs, while a browser Web Worker runs the shared seeded engine and returns a result for validation and persistence. The Blueprint creates no background worker.

Every account may launch simulations without a lifetime or season product quota. Each launch defaults to and permits at most 25 simulations. The existing 10-launches-per-15-minutes limiter remains an operational abuse/load safeguard; HTTP 429 means wait and retry, not an account entitlement limit. History retains the latest 25 completed batches. The web process reconciles requested launches older than one hour at startup and every five minutes, as well as during later launches.

The server stores the exact prepared input and its immutable digest with the issued run. Completion must match the issued account, team, season, league size, roster size, run count, seed sequence, and digest. This binds a completion to its issued launch; it is not cryptographic proof that a hostile browser executed the algorithm. The completion endpoint authenticates before reading its route-scoped 2 MiB body and admits at most two active bodies per account and eight per client address in one web process. If a completion response is lost or returns an ambiguous server error, the browser retries the same history ID and payload once; the first terminal result wins, so a committed retry returns the saved batch rather than creating another launch. Closing, refreshing, or navigating away terminates the Web Worker and sends a best-effort cancellation by the client request ID even when the launch response has not arrived. If cancellation arrives before the launch transaction commits, the unfinished row remains invisible to completed history and has no product-quota effect. The startup-and-five-minute reconciler removes it after it is one hour old, so cleanup occurs within about 65 minutes of creation rather than immediately.

The web service carries no persistent disk, so Render deploys it with zero downtime: it starts the new instance, waits for `/readyz` to pass, moves traffic over, and then shuts the old instance down about a minute later. Do not re-attach a disk. A disk pins the service to one instance and makes Render stop the old instance before starting the new one, which drops traffic on every deploy.

Two effects survive the swap window. Live draft rooms reconnect their event stream and catch up from their last revision. An in-progress browser simulation stays in its tab and can complete against the new web process. A tab that still runs the retired server-stream client receives a terminal `simulation_client_upgrade_required` stream error before the server prepares or stores a launch; refreshing loads the browser-worker client, and retrying then starts normally. A refresh or tab close stops local work, sends best-effort cancellation, and never adds an unfinished launch to completed history.

Deploying during a live draft window is now far safer, but it is not free. Render waits for the linked GitHub checks before deploying a commit from `main`, then gates traffic on `/readyz`. Prefer to hold non-urgent pushes until the draft ends so a healthy release cannot interrupt an active room unexpectedly.

The web service still stays at one instance for launch. Live-room subscribers
now coordinate revisions and connection admission through Postgres, so they no
longer block a later replica increase. Review the remaining in-process state,
including the draft-tools store cache, before going
higher.

Migrations run before the new instance starts, while the old instance still serves traffic. Keep migrations additive. A column drop or rename would break the old instance for the length of the swap window.

The practice-persistence release reserves `platform-practice-persistence-v25`, browser-simulation lifecycle cleanup uses `platform-browser-simulation-lifecycle-v26`, account onboarding uses `platform-account-onboarding-v27`, the targeted onboarding rollout uses `platform-account-onboarding-rollout-v28`, and the combined onboarding intent uses `platform-account-onboarding-intent-both-v29`. Verify the migration ledger order is v23, v24, v25, v26, v27, v28, then v29. Do not renumber these migrations or deploy a migration list that skips one.

## Validate The Blueprint

Run `npm run platform:render:validate` before applying Blueprint changes. The command uses the checked-in Render schema at `scripts/render-blueprint.schema.json`, so local and CI validation are deterministic and do not require network access. The adjacent schema README records its provider URL and refresh procedure.

To validate against a deliberately downloaded schema or a different Blueprint, pass the schema first and Blueprint second:

```bash
npm run platform:render:validate -- /path/to/render-schema.json /path/to/render.yaml
```

## 1. Create The Render Stack

1. Confirm the GitHub `main` branch is green.
2. In Render, choose **New > Blueprint** and connect this repository.
3. Select `render.yaml` and review both resources before applying it.
4. Verify a sending domain in Resend. Add `RESEND_API_KEY`, set `MOCKD_EMAIL_FROM` to that verified sender, and set `MOCKD_PUBLIC_BASE_URL` to the generated Render HTTPS origin for staging.
5. Generate a 32-byte key with `openssl rand -base64 32` in a trusted operator environment. Set `MOCKD_LEAGUE_CONNECTION_CREDENTIAL_ACTIVE_KEY_ID` to a stable id such as `credentials-2026-08`, then set `MOCKD_LEAGUE_CONNECTION_CREDENTIAL_KEYS` to a JSON object that maps that id to the generated value. Keep both settings in Render's secret environment only.
6. Confirm no provisioning token or password-hash variables are present in the Blueprint.
7. Apply the Blueprint and wait for the web service and database to become healthy.
8. Open `https://<render-subdomain>/healthz` and `https://<render-subdomain>/readyz`. Both must return HTTP 200. Readiness fails without Resend delivery, a sender, the public HTTPS origin, or a valid credential keyring. OpenAI is not required.

The Render service inherits the production-safe 650 live-draft stream default. Set
`MOCKD_LIVE_DRAFT_EVENT_STREAM_MAX_CONNECTIONS` only to raise it; production readiness
rejects a lower value. The per-account cap remains 4.

For the credential-encryption release, wait until the new web process is stable and the old zero-downtime process has stopped before opening a Render Shell and running `npm run platform:credentials:backfill`. Do not run it while rollback to the old release is still likely. The command encrypts ESPN credentials and discards cookie values historically saved on Sleeper or Yahoo connections. Verify that no legacy values remain:

```sql
SELECT count(*)
FROM league_connections
WHERE espn_s2 IS NOT NULL OR swid IS NOT NULL;
```

The result must be zero before the next logical database export.

Do not add the public domain yet. Use the generated `onrender.com` hostname for setup and staging smoke.

## 2. Create A Staging League

Create a commissioner account through the public signup flow, open the verification email, and sign in only after verification succeeds. Exercise **Forgot password** once and confirm the reset link is single-use. Then create a temporary staging league from the product. Do not run `platform:seed:e2e` against production.

The new account must see the required welcome wizard on its first authenticated product page. Confirm that Escape, the backdrop, and a refresh cannot bypass the two questions. Submit the first answer, refresh, and confirm the wizard resumes at the league-host question. Finish setup and confirm it stays complete after another refresh. Confirm the v28 rollout reopens only auto-exempt accounts created during the five days before migration execution that have never created a league. Accounts outside that window, accounts with saved onboarding answers, and accounts that created a league must remain unchanged.

After league creation, confirm the browser uses the public league slug, such as `/leagues/sunday-games/practice`. Internal season and room IDs must not appear in normal page URLs. Open one legacy ID-based link during staging and confirm the app replaces it with the matching slug URL without losing the selected page.

In Commissioner Setup:

1. Import the ESPN league settings URL or ID and review the detected draft format, team count, scoring, budget, roster slots, and position limits.
2. Enter the team names and optional manager names from the league membership page.
3. Confirm each row maps to one unique team.
4. Upload sanitized prior draft results as CSV, TSV, XLS, or XLSX and review player matching before commit.
5. Enter keepers in the command box, review the resulting roster and budget constraints, and publish the setup only after the final confirmation check passes.

Create each manager's private signup link in the separate **Invitations** section and deliver it through the league's existing secure channel. Claimed teams and accounts that already belong to the league are unavailable for invitation. Invitation links expire after seven days. The plaintext token is shown only when a link is created or reissued, so copy it before leaving the page.

The launch Blueprint disables screenshot analysis, so commissioners enter league membership information manually. To enable the optional analyzer later, set `MOCKD_SCREENSHOT_IMPORT_MODE=openai`, add `OPENAI_API_KEY`, and optionally set `MOCKD_SCREENSHOT_IMPORT_MODEL` on `sundaygames`; never add provider keys to the repository. Screenshot bytes and raw model output are not persisted by Mockd. The web service sends the image to the OpenAI Responses API with request storage disabled, keeps only the commissioner-approved team fields, limits images to 5 MB, and rate-limits analysis per commissioner and season. Use a screenshot that contains no information beyond the league membership table.

Owners normally recover access through **Forgot password** on the sign-in page. The operator command remains an emergency-only fallback when email delivery is unavailable. The target email comes from the environment and the replacement password comes from exactly one non-interactive stdin line, so neither belongs in command arguments:

New passwords must contain at least 6 characters, one ASCII digit, and one punctuation or symbol character. Spaces are allowed, but do not satisfy the punctuation-or-symbol requirement. The same rule applies to signup, verification, reset, change-password, and operator password commands.

```bash
printf '%s' "$PASSWORD_FROM_SECURE_SOURCE" | \
MOCKD_PASSWORD_RESET_EMAIL='owner@example.com' \
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
npm run --silent platform:password:reset
```

The command emits only a generic success or failure message and revokes every existing session for the account. Deliver the replacement through the secure owner channel.

## 3. Exercise Recovery

Render's paid Postgres service provides managed backups and point-in-time recovery. The web service intentionally has no attached disk. Before domain cutover:

1. Confirm both backup controls and retention windows in the Render dashboard.
2. Record the current UTC time and confirm it falls inside the database's displayed point-in-time recovery window.
3. From the database's **Recovery** page, create and download a logical export for the launch record.
4. Create a separate, empty Postgres restore-rehearsal database.
5. From a trusted operator machine with compatible `pg_dump` and `pg_restore` binaries, run:

```bash
DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:backup:postgres -- --output=/secure/backups/mockd.dump
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
MOCKD_RESTORE_TARGET_DATABASE_URL="$RESTORE_DATABASE_URL" \
npm run platform:restore:rehearse -- --backup=/secure/backups/mockd.dump
```

Backup creation refuses an unprovisioned schema, records the source database identity, and captures snapshot-consistent counts for every application table. The rehearsal verifies the backup hash, size, and source identity; refuses a non-empty or ambiguously named target; restores in one transaction; reapplies compiled migrations; runs compiled production readiness; and requires every restored application-table count to match the manifest. Keep the emitted JSON result with the launch record.

The dump contains ESPN credential envelopes after the backfill, not the raw cookie values. It does not contain the Render keyring. Keep the matching keyring in the secret store for the full backup retention window and attach it only to the isolated restored app used for the ESPN sync check. The dump still contains other private data and must keep the same restricted handling.

If the database is private-only, temporarily allow only the operator's current IP while running these commands, then restore an empty external allowlist immediately.

## 4. Activate Monitoring

1. In GitHub repository variables, set `MOCKD_PRODUCTION_BASE_URL` to the HTTPS Render hostname with no trailing path.
2. Add a repository Actions secret named `MOCKD_PRODUCTION_ALERT_WEBHOOK_URL` for a Slack-compatible HTTPS webhook owned by the named deploy team.
3. Manually run the **Production health** workflow once. It must pass, and a forced test failure must reach the named deploy owner.
4. Confirm the scheduled 15-minute readiness check runs. Missing monitor configuration fails the workflow instead of skipping it.
5. Enable Render deploy and service-health notifications. Configure external metric alerts for Postgres availability and capacity, disk usage, backup failures, and draft-window mutation errors; Render's service notifications alone do not cover all of these signals.
6. Confirm Render's daily Postgres backup controls are healthy.

The GitHub monitor checks `/readyz`, which covers the web process, Postgres, required migrations, and writable private-draft storage. `/healthz` is only process liveness.

## 5. Run Staging Smoke

Create a protected GitHub `production` Environment with required reviewers. Add credentials for one commissioner and one member plus the staging season ID as environment-scoped secrets. Keep the repository variable `MOCKD_PRODUCTION_BASE_URL` fixed to the Render HTTPS origin, then manually run **Deployed smoke**; the workflow does not accept a user-supplied destination.

The deployed smoke is deliberately read-only: it verifies both roles, league home, board, mock draft, simulations, and commissioner setup without creating, starting, selling into, or ending the real draft room. It is safe to rerun before and after DNS cutover. The full mutation and realtime flow remains covered by local E2E and the production-container gate; also complete the multi-browser draft-night rehearsal in the production runbook.

Before the first real import, create a temporary staging season with the production team count and run manual team entry, profile mapping, apply, and invitation-link creation. Confirm duplicate or missing profile mappings cannot apply and team IDs remain stable when rows are reordered or a name is corrected. If optional screenshot analysis is deliberately enabled, also run one sanitized screenshot through analyze and review and confirm uncertain rows cannot apply without commissioner confirmation and stale reviews return a conflict instead of overwriting newer setup. Delete or archive the temporary records before DNS cutover.

## 6. Attach The Domain

Only after in-product setup, recovery, monitoring, and deployed smoke pass:

1. Lower the planned DNS record's TTL.
2. Add the custom domain to `sundaygames` in Render.
3. Add the exact DNS records Render provides.
4. Wait for Render to verify the domain and issue TLS.
5. Confirm HTTP redirects to HTTPS and `/readyz` is healthy on the custom domain.
6. Change `MOCKD_PUBLIC_BASE_URL` and `MOCKD_PRODUCTION_BASE_URL` to the custom HTTPS origin, then redeploy so new verification and reset links use it.
7. Create and verify a temporary account through the custom domain, then complete one password reset.
8. Rerun **Production health** and **Deployed smoke** against the custom domain.
9. Keep the `onrender.com` hostname and previous deploy ID in the rollback record.

## Roll Back A Release

Before each manual release, record the current web deploy ID plus the UTC time, confirm that time is inside the displayed PITR window, and create/download a logical database export. If the new release fails before serving traffic, roll back the web service from its Render **Events** page to the recorded deploy. Current launch migrations are additive, so the older app should tolerate them; verify `/readyz` and login immediately.

For the hosted-snake release, apply `platform-snake-live-room-v20` and complete the web swap before creating a snake room. The old release remains safe for existing auction rooms because their recorded sales still have prices, but its snapshot decoder rejects every snake room. Keep snake room creation disabled operationally while application rollback is still likely. Once the first hosted snake room is created, roll forward; use the recorded pre-room Postgres recovery point only if roll-forward is impossible.

If a future release includes a destructive or backward-incompatible migration, mark it no-go until it has an explicit expand/migrate/contract sequence. If data must be reverted, enable maintenance mode, restore Postgres to the pre-release recovery point, roll back the web service, then rerun readiness and deployed smoke before disabling maintenance mode.

The encrypted-credential schema expansion lets the old release keep syncing existing plaintext connections during the swap. A read by the new release may add an encrypted envelope to a legacy row, but it deliberately keeps `espn_s2` and `swid` until the operator runs the backfill. The old release cannot read a connection created or repaired by the new release. After backfill, it cannot sync any saved ESPN connection because every credential is envelope-only. Prefer rolling forward. Before backfill, a rollback keeps legacy connections working but owners of newly written connections must paste fresh credentials after the fixed release returns. After backfill, rollback requires either restoring the pre-backfill database recovery point or having every affected owner paste fresh credentials after the fixed release returns.

The v22 authentication rate-limit table and v23 league-sync revision columns are additive, so an application rollback does not require a database restore. Their protections are incomplete until the old web process has stopped. Avoid provider sync and import during the v23 web swap, then rerun any operation attempted during that window after only the new release is serving traffic.

The v25 practice-persistence migration is additive, but its application rollout has two phases. It adds the immutable mock configuration column, a revision- and prefix-aware snapshot bridge, and a database mode gate, then backfills compatibility snapshots. Deploy v25 first with `MOCKD_PRACTICE_PERSISTENCE_MODE=dual-write`. New code reads normalized rows and commits each mock mutation and its compatibility snapshot CAS in one Postgres transaction. A compatibility conflict rolls back the normalized mutation. The old process can keep using snapshots during the zero-downtime swap, and the trigger accepts only a valid extension or next revision; it ignores stale prefixes and aborts a divergent snapshot write without changing normalized rows or events.

Keep dual-write mode until every pre-v25 process is deactivated and all requests that entered those processes have drained. Before the second deployment, require the snapshot-key query below to return one and the three consistency queries to return zero. These commands use the Blueprint's `mockd-production` key; substitute the configured `MOCKD_POSTGRES_SNAPSHOT_KEY` if it differs. Then set `MOCKD_PRACTICE_PERSISTENCE_MODE=normalized-only` and deploy the same or a later v25 artifact. Startup takes the cutover advisory lock, disables the bridge, scrubs mock sessions from every compatibility snapshot with a new revision and hash, and only then admits the normalized-only process. `/readyz` rejects a configured/database mode mismatch and rejects normalized-only readiness if any compatibility snapshot still contains mock sessions.

```sql
SELECT count(*)
FROM platform_store_snapshots
WHERE snapshot_key = 'mockd-production';

SELECT count(*)
FROM platform_store_snapshots AS snapshot
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(snapshot.snapshot_json->'mockDraftSessions', '[]'::jsonb)
) AS stored_session
WHERE snapshot.snapshot_key = 'mockd-production'
  AND NOT EXISTS (
  SELECT 1 FROM mock_sessions WHERE id = stored_session->>'id'
);

SELECT count(*)
FROM mock_sessions AS session
WHERE NOT EXISTS (
  SELECT 1
  FROM platform_store_snapshots AS snapshot
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(snapshot.snapshot_json->'mockDraftSessions', '[]'::jsonb)
  ) AS stored_session
  WHERE snapshot.snapshot_key = 'mockd-production'
    AND stored_session->>'id' = session.id
);

SELECT count(*)
FROM mock_sessions AS session
WHERE session.command_count <> (
  SELECT count(*)
  FROM mock_session_events AS event
  WHERE event.mock_session_id = session.id
    AND event.revision = session.revision
    AND event.event_type = 'command'
);
```

After normalized-only cutover, require both queries below to report `normalized-only` and zero. Retention may delete normalized sessions after this point; the retired bridge rejects any old-process snapshot write that still carries mock sessions, so it cannot resurrect a retained session or violate the scrub invariant.

```sql
SELECT mode
FROM platform_practice_persistence_control
WHERE singleton = true;

SELECT count(*)
FROM platform_store_snapshots AS snapshot
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(snapshot.snapshot_json->'mockDraftSessions', '[]'::jsonb)
) AS stored_session;
```

Before cutover, rollback to v23 is safe because dual writes keep its compatibility view current. After cutover, do not change the environment back to dual-write: readiness will fail because the database gate is irreversible. Roll forward, or restore the pre-cutover database recovery point before rolling the application back.

The v26 browser-simulation lifecycle migration follows v25 and is additive. It creates a partial status/creation-time index for the five-minute stale-launch reconciler. Each sweep uses a transaction advisory try-lock, so overlapping old and new web processes do not scan concurrently. Application rollback does not require a database restore.

The v27 account-onboarding migration follows v26 and is additive. It creates `account_onboarding_profiles` in the authentication database and initially marks every account that already exists when the migration runs as complete. The v28 rollout migration then removes that automatic exemption only for accounts created during the preceding five days that still have no onboarding answers and have never created a league. Run v28 only in the database that owns both authentication and normalized league records; automatic startup skips v28 when those owners are not the same Postgres client. The v29 migration reserves the additive `intent_both` boolean and must be fully deployed before exposing the combined option. The combined release stores `Both` as legacy `live_draft` plus that flag and uses a phase-1-compatible request shape. If a draining compatibility server handles that request, the wizard remains on step one and asks the user to retry instead of recording the wrong answer. Rollback to phase 1 reads the base intent and clears the flag on a later intent write. Rollback does not recreate exemptions removed by v28. Before any affected account answers the wizard, an operator can reverse the rollout by restoring completed profiles for the targeted account ids; after answers exist, keep those answers and roll forward.

Automatic deploys remain enabled with `checksPass`. Web quality, server quality, local browser smoke, and the production image/Postgres boot run once on the pull request. Protected `main` requires those current checks and auto-merge lands the pull request as soon as they pass. The resulting `main` push runs only the fast release gate, so Render can deploy without repeating the full suite. A daily workflow retains dependency auditing without delaying ordinary pull requests. Enforce the draft-day freeze by holding merges to `main`. For a documented incident response, merge the approved fix and let the checks-gated deploy run; start a manual deploy only when that incident procedure explicitly requires it.

The domain is ready for real users only when every row in the production runbook's launch checklist is marked pass.
