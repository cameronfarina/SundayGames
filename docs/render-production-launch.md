# Render Production Launch

This is the concrete first-production procedure for Mockd. The broader architecture and go/no-go rules remain in the [production runbook](./ai-plans/fantasy-draft-platform/production-runbook.md).

## What The Blueprint Creates

`render.yaml` creates these resources in Render's Virginia region:

- `mockd-web`: one paid Docker web instance with `/readyz` health checks and no persistent disk.
- `mockd-postgres`: private managed Postgres 17 on a paid plan with 15 GB of autoscaling storage.

The web service runs migrations before a release. The migration runner holds a Postgres advisory lock before any DDL. Render deploys automatically once GitHub checks pass; an operator can still deploy sooner by hand for urgent low-risk changes. League-aware simulations use a bounded worker-thread queue inside the web service, with request cancellation and a 30-second timeout, so the launch Blueprint does not create the legacy fixture-backed simulation worker.

The web service carries no persistent disk, so Render deploys it with zero downtime: it starts the new instance, waits for `/readyz` to pass, moves traffic over, and then shuts the old instance down about a minute later. Do not re-attach a disk. A disk pins the service to one instance and makes Render stop the old instance before starting the new one, which drops traffic on every deploy.

Two effects survive the swap window. Live draft rooms reconnect their event stream and catch up from their last revision. A season simulation runs inside the instance that started it, so a simulation still in flight when the old instance stops is lost and the user must run it again.

Deploying during a live draft window is now far safer, but it is not free. Render deploys every commit to main and CI runs in parallel, so a bad commit serves real traffic until the rollback job replaces it. Prefer to hold non-urgent pushes until the draft ends.

The web service still stays at one instance. Going higher needs a review of in-process state first, including the draft-tools store cache and the live-room event-stream subscribers.

Migrations run before the new instance starts, while the old instance still serves traffic. Keep migrations additive. A column drop or rename would break the old instance for the length of the swap window.

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
5. Confirm no provisioning token or password-hash variables are present in the Blueprint.
6. Apply the Blueprint and wait for the web service and database to become healthy.
7. Open `https://<render-subdomain>/healthz` and `https://<render-subdomain>/readyz`. Both must return HTTP 200. Readiness fails without Resend delivery, a sender, or the public HTTPS origin. OpenAI is not required.

Do not add the public domain yet. Use the generated `onrender.com` hostname for setup and staging smoke.

## 2. Create A Staging League

Create a commissioner account through the public signup flow, open the verification email, and sign in only after verification succeeds. Exercise **Forgot password** once and confirm the reset link is single-use. Then create a temporary staging league from the product. Do not run `platform:seed:e2e` against production.

After league creation, confirm the browser uses the public league slug, such as `/leagues/sunday-games/practice`. Internal season and room IDs must not appear in normal page URLs. Open one legacy ID-based link during staging and confirm the app replaces it with the matching slug URL without losing the selected page.

In Commissioner Setup:

1. Import the ESPN league settings URL or ID and review the detected draft format, team count, scoring, budget, roster slots, and position limits.
2. Enter the team names and optional manager names from the league membership page.
3. Confirm each row maps to one unique team.
4. Upload sanitized prior draft results as CSV, TSV, XLS, or XLSX and review player matching before commit.
5. Enter keepers in the command box, review the resulting roster and budget constraints, and publish the setup only after the final confirmation check passes.

Create each manager's private signup link in the separate **Invitations** section and deliver it through the league's existing secure channel. Claimed teams and accounts that already belong to the league are unavailable for invitation. Invitation links expire after seven days. The plaintext token is shown only when a link is created or reissued, so copy it before leaving the page.

The launch Blueprint disables screenshot analysis, so commissioners enter league membership information manually. To enable the optional analyzer later, set `MOCKD_SCREENSHOT_IMPORT_MODE=openai`, add `OPENAI_API_KEY`, and optionally set `MOCKD_SCREENSHOT_IMPORT_MODEL` on `mockd-web`; never add provider keys to the repository. Screenshot bytes and raw model output are not persisted by Mockd. The web service sends the image to the OpenAI Responses API with request storage disabled, keeps only the commissioner-approved team fields, limits images to 5 MB, and rate-limits analysis per commissioner and season. Use a screenshot that contains no information beyond the league membership table.

Owners normally recover access through **Forgot password** on the sign-in page. The operator command remains an emergency-only fallback when email delivery is unavailable. The target email comes from the environment and the replacement password comes from exactly one non-interactive stdin line, so neither belongs in command arguments:

```bash
printf '%s' "$PASSWORD_FROM_SECURE_SOURCE" | \
MOCKD_PASSWORD_RESET_EMAIL='owner@example.com' \
DATABASE_URL="$PRODUCTION_DATABASE_URL" \
npm run --silent platform:password:reset
```

The command emits only a generic success or failure message and revokes every existing session for the account. Deliver the replacement through the secure owner channel.

## 3. Exercise Recovery

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

## 4. Activate Monitoring

1. In GitHub repository variables, set `MOCKD_PRODUCTION_BASE_URL` to the HTTPS Render hostname with no trailing path.
2. Add a repository Actions secret named `MOCKD_PRODUCTION_ALERT_WEBHOOK_URL` for a Slack-compatible HTTPS webhook owned by the named deploy team.
3. Manually run the **Production health** workflow once. It must pass, and a forced test failure must reach the named deploy owner.
4. Confirm the scheduled 15-minute readiness check runs. Missing monitor configuration fails the workflow instead of skipping it.
5. Enable Render deploy and service-health notifications. Configure external metric alerts for Postgres availability and capacity, disk usage, backup failures, and draft-window mutation errors; Render's service notifications alone do not cover all of these signals.
6. Confirm Render's daily Postgres and disk backup controls are healthy.

The GitHub monitor checks `/readyz`, which covers the web process, Postgres, required migrations, and writable private-draft storage. `/healthz` is only process liveness.

## 5. Run Staging Smoke

Create a protected GitHub `production` Environment with required reviewers. Add credentials for one commissioner and one member plus the staging season ID as environment-scoped secrets. Keep the repository variable `MOCKD_PRODUCTION_BASE_URL` fixed to the Render HTTPS origin, then manually run **Deployed smoke**; the workflow does not accept a user-supplied destination.

The deployed smoke is deliberately read-only: it verifies both roles, league home, board, mock draft, simulations, and commissioner setup without creating, starting, selling into, or ending the real draft room. It is safe to rerun before and after DNS cutover. The full mutation and realtime flow remains covered by local E2E and the production-container gate; also complete the multi-browser draft-night rehearsal in the production runbook.

Before the first real import, create a temporary staging season with the production team count and run manual team entry, profile mapping, apply, and invitation-link creation. Confirm duplicate or missing profile mappings cannot apply and team IDs remain stable when rows are reordered or a name is corrected. If optional screenshot analysis is deliberately enabled, also run one sanitized screenshot through analyze and review and confirm uncertain rows cannot apply without commissioner confirmation and stale reviews return a conflict instead of overwriting newer setup. Delete or archive the temporary records before DNS cutover.

## 6. Attach The Domain

Only after in-product setup, recovery, monitoring, and deployed smoke pass:

1. Lower the planned DNS record's TTL.
2. Add the custom domain to `mockd-web` in Render.
3. Add the exact DNS records Render provides.
4. Wait for Render to verify the domain and issue TLS.
5. Confirm HTTP redirects to HTTPS and `/readyz` is healthy on the custom domain.
6. Change `MOCKD_PUBLIC_BASE_URL` and `MOCKD_PRODUCTION_BASE_URL` to the custom HTTPS origin, then redeploy so new verification and reset links use it.
7. Create and verify a temporary account through the custom domain, then complete one password reset.
8. Rerun **Production health** and **Deployed smoke** against the custom domain.
9. Keep the `onrender.com` hostname and previous deploy ID in the rollback record.

## Roll Back A Release

Before each manual release, record the current web deploy ID plus the UTC time, confirm that time is inside the displayed PITR window, and create/download a logical database export. If the new release fails before serving traffic, roll back the web service from its Render **Events** page to the recorded deploy. Current launch migrations are additive, so the older app should tolerate them; verify `/readyz` and login immediately.

If a future release includes a destructive or backward-incompatible migration, mark it no-go until it has an explicit expand/migrate/contract sequence. If data must be reverted, enable maintenance mode, restore Postgres to the pre-release recovery point, restore the web-disk snapshot only when private draft-session data also needs reversal, roll back the web service, then rerun readiness and deployed smoke before disabling maintenance mode.

Automatic deploys stay off. During the draft-day freeze, do not start a manual web deploy except as part of the documented incident response.

The domain is ready for real users only when every row in the production runbook's launch checklist is marked pass.
