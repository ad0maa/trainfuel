# Consolidation & Completion Plan

> **Decision (2026-07-22):** kitkaboodle (TrainFuel, CedarJS) is the app we finish.
> The `health` repo (Django "FullStackTrainer") is a donor: its deterministic
> running-plan engine and its working Strava integration get ported here, then it is
> archived. `python-backend` (FastAPI) and `health-life` (empty) are abandoned — no
> salvage value.
>
> Goal framing: portfolio piece + something friends can actually use. Optimize for
> **shipping**, not completeness — a fast-path cut line is defined in Phase F below.

This plan extends SPEC.md's milestone ladder (M0–M7). M0–M1 are committed; M2 is
complete-but-uncommitted in the working tree. New work slots in as **M2.5** (plan
generator port) and modifies **M3** (Strava, now a port rather than greenfield).

---

## Phase 0 — Stabilize what exists (do first, ~1 session)

1. **[HUMAN] Run `yarn cedar test` once** from a terminal. Prisma's AI-agent guardrail
   blocks the test-DB reset (`db push --force-reset` on `trainfuel_test`) from agents;
   the M1 service scenario tests (`trainingBlocks.test.ts`, `scheduledItems.test.ts`)
   and the M2 service tests have **never executed**. This is the single biggest unknown
   in the codebase. Fix anything red.
2. **Commit M2** (food core): energy module, nutrition libs, foods/foodLogEntries/
   dailySummary services + SDL, FoodSearchLogger/FoodLogPage, seedAfcd +
   rollupDailyMetrics scripts, the two new migrations, and the DECISIONS.md /
   docker-compose removal changes. Suggested: `✨ M2: food core — AFCD seed, food log,
   energy targets, daily rollups`.
3. **Add the missing M2 section to DECISIONS.md** (the log currently ends at M1 —
   document the pg_trgm search, snapshot-nutrients approach, seed decisions).
4. Housekeeping in `~/projects/temp-health/`: delete `health-life/` (empty), stop
   touching `python-backend/` (commit or discard its 571-line uncommitted nutrition WIP
   — recommend discard, kitkaboodle's M2 supersedes it), keep `health/` read-only as
   the donor. Also note: `health` has 5 stale agent worktrees pointed at its initial
   commit — nothing of value, prune when archiving.

---

## Phase 1 (M2.5) — Port the running-plan generator from `health`

The one substantial piece of finished logic the Django repo has that this repo lacks.
SPEC.md §7.1 called template auto-generation a "stretch goal"; the stretch is already
written and tested in Python — port it.

### Source → target map

| Donor (health repo) | Target (kitkaboodle) | Notes |
|---|---|---|
| `backend/apps/plans/templates.py` (352 lines: C25K/5K/10K/21.1K week-by-week) | `api/src/lib/planTemplates/templates.ts` | Mechanical translation: frozen dataclasses → `readonly` interfaces + `as const` data. Keep `weekNo`, `targetVolumeKm`, `phase`, `isRecovery`, sessions `{day, sessionType, targetDistanceKm?, targetDurationMin?, description}`. |
| `backend/apps/plans/engine.py` — `find_entry_week`, `check_feasibility` | `api/src/lib/planTemplates/generatePlan.ts` | Port as a **pure function** (matching the `materializeRecurringItems` pattern): input `{goalType, currentWeeklyKm, startDate, goalDate?, timezone}` → output `{blocks: [...], items: [...], feasibility}`. **No DB access** — the service does the writes. |
| `backend/apps/plans/tests/test_engine.py` (104 lines) | `api/src/lib/planTemplates/generatePlan.test.ts` | Port every case (entry-week matching, never-enter-taper, C25K always week 1, feasibility gate) + add date-mapping cases. |

### Schema mapping (no new models needed)

Donor `Plan/PlanWeek/PlanSession` map onto the existing `TrainingBlock` +
`ScheduledItem`:

- **One `TrainingBlock` per contiguous phase segment** of the generated plan (e.g. a
  5K plan entered at week 5 → blocks "5K — Build" + "5K — Peak" + "5K — Taper").
  Phase mapping: `base → REBUILD`, `build → BUILD`, `peak → BUILD`, `taper → TAPER`
  (do **not** extend the `BlockPhase` enum; record mapping in DECISIONS.md).
- **One `ScheduledItem` (type `RUN`) per template session.** Template `day` (1=Mon…7=Sun)
  → concrete `scheduledAt`: weeks anchor on the first Monday ≥ `startDate`, default
  start time 07:00 **in `Profile.timezone`** via the existing `localDay` helpers
  (SPEC §9 timezone paranoia applies — this is day-boundary logic).
- **`prescription` JSON carries the template detail** and directly feeds M7's Level 2
  carb periodization (§6.3):
  ```json
  {
    "sessionType": "long" | "easy" | "tempo" | "interval" | "walk_run",
    "targetDistanceKm": 8.0,
    "targetDurationMin": null,
    "weekNo": 3,
    "phase": "build",
    "isRecoveryWeek": false,
    "isLongRun": true,        // sessionType === "long"  → LONG_RUN day (5 g/kg carbs)
    "isQualityRun": false     // tempo|interval          → QUALITY_RUN day (4 g/kg)
  }
  ```
- Feasibility result is **returned to the client as a warning, never an exception**
  (donor behaviour — preserve it; it's a SPEC "hard rules" pattern worth keeping).

### Service + UI

- `generateTrainingPlan` mutation (`api/src/services/trainingPlans/` or extend
  `trainingBlocks`): validates input, calls the pure generator, `createMany`s blocks +
  items in a transaction, returns blocks + feasibility warning.
- Web: "Generate plan" form on PlanPage (goal type, current weekly km, start date,
  optional goal/race date) → renders feasibility warning if present. Reuse existing
  week-view to display the result — no new visualization needed.
- Guard: generating a plan that overlaps existing RUN items on the same dates →
  surface a confirm, don't silently double-book.

**Explicitly not ported:** `health`'s TDEE module (`users/tdee.py`). Kitkaboodle's
`api/src/lib/energy/` already covers BMR + Level 1 with tests and follows SPEC §6
(BMR floor beats the donor's flat 1200 kcal floor). **One guardrail to adopt from the
donor:** clamp `Profile.weeklyWeightDeltaKg` at write time (suggest `[-1.0, +0.5]`
kg/week, mirroring the donor's MAX_DEFICIT/MAX_SURPLUS caps) — currently unvalidated.

---

## Phase 2 (M3) — Strava, ported not greenfield

SPEC §4.1 scope, using the donor's working implementation as the reference. The donor
solved: OAuth code exchange, transparent pre-call token refresh, webhook GET
hub-challenge validation, fast-200 POST handling, paginated backfill, kJ→kcal
fallback, and an activity type map.

### Source → target map

| Donor | Target | Adaptation |
|---|---|---|
| `sync/strava.py` (`StravaClient`) | `api/src/lib/integrations/strava.ts` | Same shape: `getAuthUrl`, `exchangeCode`, `listActivities(after?, page)`, `getActivity`. Token refresh stays **inside the client** (donor pattern, matches SPEC "refresh proactively in the integration client, not in callers"). Tokens live in `IntegrationAccount` (provider `STRAVA`), athlete id in `meta`. Handle 429 backoff (donor doesn't — SPEC requires it). |
| `sync/views.py` `StravaWebhookView` | `api/src/functions/stravaWebhook.ts` | GET: echo `hub.challenge` when `hub.verify_token` matches env. POST: validate shape, **return 200 immediately**, enqueue processing (below). |
| `sync/views.py` connect/callback/status | `connectStrava` / Cedar function for OAuth callback + `integrationStatus` query | Status feeds the Settings screen per SPEC §9 error-surfacing rule. |
| `sync/tasks.py` (Celery backfill + webhook fetch) | Cedar background jobs (`yarn cedar setup jobs`) — `stravaBackfillJob`, `stravaActivityFetchJob` | If Cedar jobs fight back, fall back to the SPEC-sanctioned `node-cron` worker; record in DECISIONS.md. |
| `sync/ingest.py` type map + kJ→kcal (`× 0.239006`) | `api/src/lib/integrations/stravaIngest.ts` (pure normalizer) | Normalize provider payload → `ExternalActivity` upsert on `@@unique([source, externalId])`. **Drop the donor's fuzzy cross-source dedup** (±60s/10% duration) — that solved Strava-vs-HealthKit overlap, which SPEC defers to v2; the unique constraint is v1's dedup. |
| — (donor has no equivalent) | `api/src/lib/matching.ts` | The auto-tick engine is **SPEC §3.3's six rules, built fresh with unit tests** — the donor never had session matching. This is the one genuinely new piece in M3. |
| — | `api/src/lib/crypto.ts` | AES-256-GCM token encryption, deferred from M0 (`TOKEN_ENCRYPTION_KEY` already reserved in env). Now due — M3 is the first milestone that stores a token. |

Backfill: donor pulls *all* history; SPEC says last 30 days on first connect — follow
SPEC (pass `after`).

Dev webhook URL: tunnel (`cloudflared`/`ngrok`) until hosting is chosen.

### After M3, the app is demoable end-to-end
Plan generated → sessions on the calendar view → run recorded on watch → Strava →
auto-ticked with source badge → daily calorie target moves. That's the folio demo.

---

## Phase 3+ — remaining SPEC milestones (unchanged scope)

- **M4 Hevy** (poll job, ExternalExercise normalization, lift auto-tick) — reuses M3's
  job + matching infrastructure, small.
- **M5 Google Calendar** (push/patch/delete, reminder offsets, nightly reconcile).
- **M6 Mobile** (Expo: Today/tick, barcode → OFF, HealthKit weight/energy, offline
  queue). The donor's Expo app is a *different* API client (REST/axios) — its screens
  are reference-only; don't port code, the mobile side consumes GraphQL here.
- **M7 Polish** (Progress screens, Level 2 macros wired to the plan — the
  `prescription.isLongRun/isQualityRun` flags from M2.5 make this nearly free).

## Phase F — fast-path cut line (recommended for "get it done")

To ship for folio + friends soonest, the cut is:

**Ship = Phase 0 → M2.5 → M3 → mini-M7 (Progress page + empty states) → deploy.**

Defer past launch: M4 (Hevy — needs a Hevy Pro sub anyway), M5 (Calendar — needs a
Google Cloud consent screen), M6 (Mobile — needs an Apple dev account + dev build;
the web app is responsive enough for friends' phones in the meantime). All three are
additive and none block the core loop.

Friends-usable also means **hosting becomes the real blocker** (open item #2):
Postgres + a long-lived process for jobs/webhook → Fly/Render/VPS + managed Postgres
(Neon fits; `@prisma/adapter-pg` already host-portable by design). Decide at M3 time —
the Strava webhook needs the public URL.

---

## Owner checklist (things only a human can do)

| # | Item | Blocks |
|---|---|---|
| 1 | Run `yarn cedar test` once locally (consent for test-DB reset) | Phase 0 |
| 2 | Register a Strava API application (client id/secret, callback domain) | M3 |
| 3 | Choose hosting + provision Postgres; set the public webhook URL | M3 launch |
| 4 | Real product name (or ship as TrainFuel) | M7/deploy |
| 5 | Hevy Pro + API key | M4 (deferred) |
| 6 | Google Cloud project + OAuth consent screen | M5 (deferred) |
| 7 | Apple Developer account (HealthKit entitlement) | M6 (deferred) |

## DECISIONS.md entries to write as we go

- Phase mapping `base/peak → REBUILD/BUILD` (no enum extension) + Monday-anchor +
  07:00 local default start time for generated sessions.
- Plan generator ported from the `health` repo's Django implementation (provenance
  note + what was dropped: Plan/PlanWeek/PlanSession models, fuzzy dedup).
- `weeklyWeightDeltaKg` clamp values.
- Background-job mechanism chosen for M3 (Cedar jobs vs node-cron).
- Backfill window (30 days per SPEC, diverging from donor's full history).
