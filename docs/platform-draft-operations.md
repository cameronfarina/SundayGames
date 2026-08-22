# Platform draft operations

The creator-only draft operations page shows every scheduled league season across the
platform, including schedules that do not have a live room yet. A real room's scheduled
time takes precedence over the season setup time. The page separates drafts occurring
today from the next 30 days and estimates today's peak overlap using a three-hour draft
window.

Platform access is independent from league roles. An account that owns or administers a
league is not a platform administrator unless its exact account ID appears in
`MOCKD_PLATFORM_ADMIN_ACCOUNT_IDS`.

## Configure Render

- `MOCKD_PLATFORM_ADMIN_ACCOUNT_IDS`: comma-separated account IDs allowed to open the
  platform draft schedule.
- `MOCKD_PLATFORM_DRAFT_OPERATIONS_TIMEZONE`: operational day boundary and digest display
  timezone. The default is `America/New_York`.
- `MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN`: secret required by the scheduled HTTP
  trigger. Use at least 32 random characters.
- `MOCKD_PLATFORM_DRAFT_DIGEST_WEBHOOK_URL`: separate Discord webhook that receives the
  daily schedule. Do not reuse the production-health webhook.

Add `MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN` to both Render and the GitHub Actions
secret with the same value. Keep the Discord webhook only in Render. The scheduled GitHub
workflow calls the production endpoint once daily, so no continuously running worker is
required.

1. In Discord, open the private operations channel, choose **Edit Channel > Integrations >
   Webhooks**, and create a webhook used only for the draft digest.
2. Generate the trigger token locally with `openssl rand -hex 32`.
3. In the Render `sundaygames` service, open **Environment** and set the four variables
   above. `MOCKD_PLATFORM_ADMIN_ACCOUNT_IDS` must contain account IDs, not emails, league
   IDs, or league roles. Redeploy after saving them.
4. Do not put either secret in Git, the browser, Discord messages, or a query string. The
   browser schedule request uses the signed-in account session; only the scheduled POST
   uses the trigger token.

The Blueprint declares these variables but does not contain their secret values. A missing
admin allowlist safely denies everyone. The digest endpoint returns 503 unless both the
trigger token and webhook are configured.

## Configure the daily trigger

1. In GitHub, open **Settings > Secrets and variables > Actions**.
2. Confirm the repository variable `MOCKD_PRODUCTION_BASE_URL` is the credential-free
   production HTTPS origin.
3. Add the repository secret `MOCKD_PLATFORM_DRAFT_DIGEST_TRIGGER_TOKEN` with exactly the
   same value stored in Render. The Discord webhook does not belong in GitHub.
4. Open **Actions > Daily draft operations digest > Run workflow**. Confirm the run returns
   HTTP 204 and the private Discord channel receives the report.

The workflow runs at 13:05 UTC each day. GitHub cron is UTC and may be delayed briefly.
The endpoint computes “today,” display times, and concurrency using
`MOCKD_PLATFORM_DRAFT_OPERATIONS_TIMEZONE`, including daylight-saving boundaries.
Until the GitHub trigger secret is added, scheduled runs succeed with a notice and do not
call production. This lets the application deploy before Discord is configured without
creating a known-failing daily workflow.

If the workflow returns 403, the GitHub and Render trigger tokens differ. A 503 means the
Render trigger token or Discord webhook is missing. Other non-2xx responses fail the
workflow. Automatic retries are disabled to avoid duplicate Discord posts; inspect the
Render request log before manually rerunning it. Rotate a leaked token in both
places, and rotate a leaked Discord webhook in Render only.

## Rollout check

1. Open `/platform-admin/drafts` using an allowlisted account and confirm today's and
   upcoming drafts match commissioner schedules.
2. Confirm a league administrator who is not allowlisted receives HTTP 403.
3. Run **Daily draft operations digest** manually and confirm Discord receives one report;
   then confirm the next scheduled run succeeds without a paid worker.
4. Create a scheduled season without a room and confirm it appears as **Room not created**.
