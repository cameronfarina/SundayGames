# Production Readiness Roadmap

Mockd is currently optimized for Cam's draft-night workflow: one local league, one local machine, deterministic files, and fast iteration. That is the right shape until the model is trusted in a real room. A hosted multi-league product should add infrastructure only when the league-specific engine has proven useful.

## Current Local Architecture

- Deterministic engine inputs: projections, keepers, historical boards, player context evidence, and raw sale commands.
- File-backed live sessions: `live-draft-log.jsonl`, `live-draft-current.json`, and `live-draft-backup.json`, with audit-log recovery if both snapshots are damaged.
- Every live mutation is serialized per session and writes through the session store before the server accepts it.
- Strategy selection changes Cam's personal value layer, not the underlying league market price.
- Interactive mock actions use isolated practice-session files, and the live session is locked against mock advances.

This does not need a database for the first real draft night. A database becomes useful when multiple users, multiple leagues, auth, hosted persistence, uploads, collaboration, and historical calibration jobs need to exist at the same time.

## Before A Real Draft

1. Keep one real session directory for draft night and one or more separate practice directories.
2. Export the command log before the draft starts and after any long break.
3. Run `npm run draft:ready -- --owner=Cam --strategy=three-rb --scenario=expected --runs=50 --qa-runs=2 --strategy-mode=force`.
4. Run `npm run smoke -- --scenario=expected --runs=2 --seed=smoke` and inspect the first two rounds for obviously unrealistic prices.
5. Keep the ESPN projection input and checked-in player evidence unchanged during the draft unless a correction is intentional.
6. Confirm every owner keeper decision in `config/keepers.ts`; partial coverage stays visible as a readiness warning.

## Completed Local Slices

1. Named session controls in the UI for `live`, `practice-3rb`, `practice-wr-heavy`, and custom scratch rooms.
2. Draft-night lock mode that blocks mock advance actions in the real live session.
3. One-click session export bundle containing current snapshot, backup, JSON commands, CSV commands, and readiness status.
4. Compact command conflict review for invalid imports and ambiguous player names.
5. Direct "nominate for Cam" support in the interactive mock when the snake turn reaches Cam.
6. Mock speed controls: next AI sale, next Cam decision, next round, and complete mock.
7. Strategy comparison rows so one player can show Balanced / 3RB / Hero RB / WR Heavy personal values side by side.
8. Post-draft audit that compares actual sale prices to expected, live, personal, and mock ranges.
9. Mock-results rankings that separate Week 1 lineup score from Season strength, where Season strength blends starter projection, bench depth, and consistency from the current projection horizon.
10. Real-room reset/import protections that require confirmation plus the current command count.
11. Room-wide target visibility after Cam hits a roster max, with Cam-ineligible targets excluded from Cam values and shortlist logic.
12. Selected-strategy-only batch mocks so run results compare realistic variations of one chosen plan.
13. Audit-log recovery when current and backup snapshots are corrupted.
14. Keeper-coverage readiness warnings in both the CLI and live UI.

## Hosted Product Slices

1. Accounts and auth.
2. League setup: teams, budgets, roster rules, scoring, keepers, nomination style, and source provider.
3. Upload pipeline for historical draft boards with mapping, validation, and owner/player normalization review.
4. Provider adapters for projections, auction values, bye weeks, injuries, depth charts, schedules, and factual context.
5. Durable database tables for leagues, seasons, owners, players, projections, keepers, commands, sessions, evidence, and model runs.
6. Background calibration jobs that rebuild league economics after uploads or projection updates.
7. Versioned model outputs so draft-room state can always explain which inputs produced each number.
8. Collaborative live rooms with optimistic updates, undo permissions, and audit history.
9. Practice mock sessions that are isolated from live draft sessions by default.
10. Export/import APIs for backup, support, and user trust.

## Hosted Setup Available

Commissioners enter league identity, team numbers, abbreviations, team names, and manager names manually for launch. Every row must map to one unique existing Mockd profile. Profile mapping preserves account assignments, keepers, and historical behavior even when ESPN rows are reordered. Manager email and invitation state stay in the separate invitation flow; claimed teams and existing league members cannot receive another invitation.

Screenshot analysis remains optional. Set `MOCKD_SCREENSHOT_IMPORT_MODE=openai` and `OPENAI_API_KEY` only when the deploy owner deliberately enables it; `MOCKD_SCREENSHOT_IMPORT_MODEL` can override the built-in model default. Images are limited to 5 MB, analysis is rate-limited and concurrency-limited, OpenAI request storage is disabled, and screenshot analysis does not block health checks or snapshot writes. The production Blueprint uses `MOCKD_SCREENSHOT_IMPORT_MODE=disabled`, and readiness treats manual commissioner entry as launch-ready without any OpenAI configuration.

Hosted live-draft mutations are limited to 30 changes per account and room each minute. Postgres retains one full room recovery base and the two newest compact revision snapshots. Compact snapshots contain only mutable room metadata; normalized draft events and recorded sales or picks remain the authoritative audit trail, and room projections are rebuilt from that trail during restart.

## Hosted Domain Gate

A public domain is no-go until `docs/ai-plans/fantasy-draft-platform/production-runbook.md` is all pass.

Minimum blockers to clear:

1. `platform:ready`, `platform:migrate`, web, worker, and browser smoke all pass with Postgres-backed storage.
2. Real production league data is created through an approved path; `platform:seed:e2e` is not a production seed.
3. Automated backups are enabled, a pre-cutover snapshot exists, and restore has been rehearsed into an isolated database within 7 days.
4. DNS, TLS, monitoring, alerts, rollback, and draft-night degraded mode have named owners.
5. Manual staging league setup and manager invitation have passed against the production build. If screenshot analysis is enabled, a sanitized screenshot import has also passed and the deploy owner has confirmed the OpenAI project key, spend limits, and usage monitoring.

The key architectural rule stays the same in both local and hosted modes: the engine should rebuild from explicit inputs and command history. Hidden mutable model state is how a draft tool becomes impossible to trust.
