# Render Production Launch

This is the concrete first-production procedure for Mockd. The broader architecture and go/no-go rules remain in the [production runbook](./ai-plans/fantasy-draft-platform/production-runbook.md).

## What The Blueprint Creates

`render.yaml` creates these resources in Render's Virginia region:

- `mockd-web`: one paid Docker web instance with `/readyz` health checks and a 1 GB persistent disk mounted at `/var/lib/mockd/draft-tools`.
- `mockd-worker`: one paid Docker background worker that claims simulation jobs.
- `mockd-postgres`: private managed Postgres 17 on a paid plan with 15 GB of autoscaling storage.

Both services run migrations before a release. The migration runner holds a Postgres advisory lock before any DDL, so simultaneous web and worker pre-deploy steps are serialized safely. Automatic deploys are disabled; the deploy owner starts a release manually only after GitHub checks pass.

The web service intentionally stays at one instance. Render persistent disks attach to only one instance, and disk-backed services have a short stop/start window during deploys. Do not deploy during the live draft window.

## 1. Create The Render Stack

1. Confirm the GitHub `main` branch is green.
2. In Render, choose **New > Blueprint** and connect this repository.
3. Select `render.yaml` and review all three resources before applying it.
4. Add the prompted `OPENAI_API_KEY` secret to `mockd-web`. The Blueprint enables screenshot import with `MOCKD_SCREENSHOT_IMPORT_MODE=openai`; never add the key to the repository or worker.
5. Confirm no provisioning token or password-hash variables are present in the Blueprint.
6. Apply the Blueprint and wait for both services to become healthy.
7. Open `https://<render-subdomain>/healthz` and `https://<render-subdomain>/readyz`. Both must return HTTP 200. Readiness fails when screenshot import is enabled without its API key.

Do not add the public domain yet. Use the generated `onrender.com` hostname for provisioning and staging smoke.

## 2. Prepare Real Owner Accounts

Create an owner mapping outside the repository. It must contain all 14 configured owners, real email addresses, and one unique password-hash environment variable per owner:

```json
{
  "commissionerOwner": "Cam",
  "owners": [
    {
      "owner": "Cam",
      "email": "real-address@example.net",
      "passwordHashEnv": "MOCKD_PROVISION_CAM_PASSWORD_HASH"
    }
  ],
  "selectedKeepers": [
    {
      "owner": "Cam",
      "player": "De'Von Achane"
    }
  ]
}
```

The abbreviated example is not valid input; include every owner from `config/league.ts`. `selectedKeepers` is the explicit, reviewed keeper list. It may be empty, every pair must match `config/keepers.ts`, and an `assumed` keeper is excluded unless the reviewer deliberately selects it. Then build and generate the reviewed provisioning document:

```bash
npm ci
npm run build
npm run platform:provision:generate -- /secure/owner-accounts.json /secure/mockd-production-2026.json
```

Generate a unique launch password for each owner and hash it without placing the plaintext password in shell history:

```bash
printf '%s' "$PASSWORD_FROM_SECURE_SOURCE" | npm run --silent platform:password:hash
```

Store only the resulting hash in the Render secret value named by that owner's `passwordHashEnv`. Deliver plaintext passwords to owners through a separate secure channel. After signing in, each owner can choose **Account > Change password**; a successful change signs that account out on every device.

Never commit the mapping, generated provisioning document, password hashes, or passwords.

## 3. Provision Through A One-Off Job

Temporarily add the reviewed provisioning document to `mockd-web` as a Render secret file named `mockd-production.json`. Render mounts it at `/etc/secrets/mockd-production.json`; the file is too large for a reliable environment-variable payload. Also add every password-hash variable referenced by the document as a secret environment variable.

Run this as a Render one-off job for `mockd-web`:

```bash
npm run platform:provision -- /etc/secrets/mockd-production.json --dry-run && npm run platform:provision -- /etc/secrets/mockd-production.json && npm run platform:provision -- /etc/secrets/mockd-production.json --verify
```

The job must report a clean dry run, a successful apply, and a successful verification. Afterward, remove the temporary secret file and password-hash variables from Render. The stored account hashes remain in Postgres.

Never run `platform:seed:e2e` against production.

After the commissioner can sign in, use **Commissioner > Import from ESPN screenshot** to replace the seeded team identities from the ESPN League Members page. The review table imports team numbers, abbreviations, team names, and manager names only. It does not import email addresses, invitation status, or behavioral owner profiles. Confirm that each imported team maps to the correct existing Mockd profile so account assignments, keepers, and historical behavior stay attached to the right owner. Correct truncated names, confirm every uncertain row, and apply before creating the live draft room.

Create each manager's private signup link in the separate **Invitations** section and deliver it through the league's existing secure channel. Claimed teams and accounts that already belong to the league are unavailable for invitation. Invitation links expire after seven days. The plaintext token is shown only when a link is created or reissued, so copy it before leaving the page.

Screenshot bytes and raw model output are not persisted by Mockd. The web service sends the image to the OpenAI Responses API with request storage disabled, keeps only the commissioner-approved team fields, limits images to 5 MB, and rate-limits analysis per commissioner and season. Use a screenshot that contains no information beyond the league membership table.

If an owner loses access, reset that one account from a trusted operator machine. The target email comes from the environment and the replacement password comes from exactly one non-interactive stdin line, so neither belongs in command arguments:

```bash
printf '%s' "$PASSWORD_FROM_SECURE_SOURCE" | \
MOCKD_PASSWORD_RESET_EMAIL='owner@example.com' \
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
npm run --silent platform:password:reset
```

The command emits only a generic success or failure message and revokes every existing session for the account. Deliver the replacement through the secure owner channel. Do not rerun immutable production provisioning after passwords have changed; its original credential digests are part of the launch receipt.

## 4. Exercise Recovery

Render's paid Postgres service provides managed backups and point-in-time recovery. The attached web disk receives automatic daily snapshots. Before domain cutover:

1. Confirm both backup controls and retention windows in the Render dashboard.
2. Record the current UTC time and confirm it falls inside the database's displayed point-in-time recovery window.
3. From the database's **Recovery** page, create and download a logical export for the launch record.
4. Confirm a current web-disk snapshot exists.
5. Create a separate, empty Postgres restore-rehearsal database.
6. From a trusted operator machine with compatible `pg_dump` and `pg_restore` binaries, run:

```bash
DATABASE_URL="$PRODUCTION_DATABASE_URL" npm run platform:backup:postgres -- --output=/secure/backups/mockd.dump
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
MOCKD_RESTORE_TARGET_DATABASE_URL="$RESTORE_DATABASE_URL" \
npm run platform:restore:rehearse -- --backup=/secure/backups/mockd.dump
```

Backup creation refuses an unprovisioned schema, records the source database identity, and captures snapshot-consistent counts for every application table. The rehearsal verifies the backup hash, size, and source identity; refuses a non-empty or ambiguously named target; restores in one transaction; reapplies compiled migrations; runs compiled production readiness; and requires every restored application-table count to match the manifest. Keep the emitted JSON result with the launch record.

If the database is private-only, temporarily allow only the operator's current IP while running these commands, then restore an empty external allowlist immediately.

## 5. Activate Monitoring

1. In GitHub repository variables, set `MOCKD_PRODUCTION_BASE_URL` to the HTTPS Render hostname with no trailing path.
2. Add a repository Actions secret named `MOCKD_PRODUCTION_ALERT_WEBHOOK_URL` for a Slack-compatible HTTPS webhook owned by the named deploy team.
3. Manually run the **Production health** workflow once. It must pass and a forced test failure must reach the named deploy owner.
4. Confirm the scheduled 15-minute readiness check runs. Missing monitor configuration fails the workflow instead of skipping it.
5. Enable Render deploy and service-health notifications. Configure external metric alerts for Postgres availability/capacity, disk usage, queue stalls, backup failures, and draft-window mutation errors; Render's service notifications alone do not cover all of these signals.
6. Confirm Render's daily Postgres and disk backup controls are healthy.

The GitHub monitor checks `/readyz`, which covers the web process, Postgres, required migrations, and writable private-draft storage. `/healthz` is only process liveness.

## 6. Run Staging Smoke

Create a protected GitHub `production` Environment with required reviewers. Add credentials for one commissioner and one member plus the provisioned production season ID as environment-scoped secrets. Keep the repository variable `MOCKD_PRODUCTION_BASE_URL` fixed to the Render HTTPS origin, then manually run **Deployed smoke**; the workflow does not accept a user-supplied destination.

The deployed smoke is deliberately read-only: it verifies both roles, league home, board, mock draft, simulations, and commissioner setup without creating, starting, selling into, or ending the real draft room. It is safe to rerun before and after DNS cutover. The full mutation and realtime flow remains covered by local E2E and the production-container gate; also complete the multi-browser draft-night rehearsal in the production runbook.

Before the first real import, create a temporary staging season with the production team count and run one sanitized screenshot through analyze, profile mapping, review, apply, and invitation-link creation. Confirm uncertain rows cannot apply without commissioner confirmation, duplicate or missing profile mappings cannot apply, stale reviews return a conflict instead of overwriting newer setup, and the imported team IDs remain stable when rows are reordered or a name is corrected. Delete or archive the temporary records before DNS cutover.

## 7. Attach The Domain

Only after provisioning, recovery, monitoring, and deployed smoke pass:

1. Lower the planned DNS record's TTL.
2. Add the custom domain to `mockd-web` in Render.
3. Add the exact DNS records Render provides.
4. Wait for Render to verify the domain and issue TLS.
5. Confirm HTTP redirects to HTTPS and `/readyz` is healthy on the custom domain.
6. Change `MOCKD_PRODUCTION_BASE_URL` to the custom HTTPS domain.
7. Rerun **Production health** and **Deployed smoke** against the custom domain.
8. Keep the `onrender.com` hostname and previous deploy ID in the rollback record.

## Roll Back A Release

Before each manual release, record the current web and worker deploy IDs plus the UTC time, confirm that time is inside the displayed PITR window, and create/download a logical database export. If the new release fails before serving traffic, roll back both services from their Render **Events** pages to the recorded deploys. Current launch migrations are additive, so the older app should tolerate them; verify `/readyz` and login immediately.

If a future release includes a destructive or backward-incompatible migration, mark it no-go until it has an explicit expand/migrate/contract sequence. If data must be reverted, enable maintenance mode, restore Postgres to the pre-release recovery point, restore the web-disk snapshot only when private draft-session data also needs reversal, roll back both services, then rerun readiness and deployed smoke before disabling maintenance mode.

Automatic deploys stay off. During the draft-day freeze, do not start a manual web or worker deploy except as part of the documented incident response.

The domain is ready for real users only when every row in the production runbook's launch checklist is marked pass.
