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

> **Status update (2026-09-15):** this file previously went stale after M4 — Phase
> 4+ below listed M5/M6/M7 as a flat "remaining scope" block. Since then, **M7
> (Polish) and M6 (Mobile) have both shipped**; only **M5 (Google Calendar)**
> remains unbuilt from SPEC.md's full ladder. See Phases 4–6 below (renumbered from
> the old "Phase 4+" placeholder) for what actually shipped in each. No commits have
> landed on `trainfuel-cedar`'s `main` since M7 merged (2026-07-23); `trainfuel-mobile`
> (separate repo) has one additional merged PR since its own scaffold.

---

## Phase 0 — Stabilize what exists ✅ done (2026-07-23)

1. ✅ **[HUMAN] ran `yarn cedar test` once** — test DB reset, 9 suites / 73 tests
   green, including the previously-never-executed M1/M2 service tests. Full suite
   (`SKIP_DB_PUSH=1 yarn cedar test`) later confirmed at 18/18 suites, 103/103 tests.
2. ✅ **Committed M2** (food core) — `✨ M2: food core — AFCD seed, food search & log,
   energy targets, daily rollups` (39 files, 2607 insertions).
3. ✅ **Added the M2 section to DECISIONS.md** (AFCD seed, pg_trgm search, schema gap
   fix, nutrient snapshots/rollups).
4. ⬜ Still open: delete `health-life/` (empty), discard `python-backend`'s
   uncommitted nutrition WIP, prune `health`'s 5 stale agent worktrees when archiving.
   None of these block further kitkaboodle work — housekeeping only, do whenever.

---

## Phase 1 (M2.5) — Port the running-plan generator from `health` ✅ done (2026-07-23)

**Shipped:** `api/src/lib/planTemplates/{templates,generatePlan}.ts` (+36 tests, all
green), `api/src/services/trainingPlans/trainingPlans.ts` (`generateTrainingPlan`
mutation, +5 scenario tests), `api/src/graphql/trainingPlans.sdl.ts`, and a
`GenerateTrainingPlanForm` component wired into `PlanPage`. Full project suite:
21/21 test suites, 144/144 tests; lint and type-check clean. Full rationale — including
the corrected `findEntryWeek` test cases (the donor's own `test_exact_match_on_volume`
was wrong against its own template data) and the DST/session-time caveat — is in
DECISIONS.md's "M2.5 — Plan generator" section, not duplicated here.

**Still open from this phase:** the `weeklyWeightDeltaKg` clamp (deferred, noted
below — this phase's work needed no schema change at all, so it's untouched).

<details>
<summary>Original phase brief (kept for context — see DECISIONS.md for what actually shipped)</summary>

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

</details>

---

## Phase 2 (M3) — Strava, ported not greenfield ✅ done (2026-07-23)

**Shipped:** `api/src/lib/crypto.ts` (AES-256-GCM token encryption, +7 tests),
`api/src/lib/integrations/{strava,stravaIngest}.ts` (client with 429 backoff +
proactive refresh, ingest normalizer, +19 tests), `api/src/lib/matching.ts` (SPEC
§3.3's six-rule auto-tick engine, +9 tests), `api/src/services/externalActivities/`
(ingest/match/unmatched-tray/manual-link, +10 tests) and
`api/src/services/integrationAccounts/` (OAuth connect + status, +5 tests),
`api/src/functions/stravaWebhook.ts`, `scripts/backfillStravaActivities.ts`, plus web:
`SettingsPage`/`StravaIntegrationCell` (connect flow) and `UnmatchedActivitiesCell` on
the Dashboard (manual link picker). Full project suite: 27/27 test suites, 194/194
tests; lint and type-check clean. One real bug caught by the linter, not review: an
unused `redirectUri` param on `exchangeStravaCode` (Strava's token endpoint doesn't
need it) — see DECISIONS.md "M3" for that and every other design decision (matching
rules 5/6 enforcement, the circular-import fix behind `stravaTokens.ts`, the
fire-and-forget backfill tradeoff, the lean `ExternalActivity` GraphQL type).

**Also done this session, unrelated to Strava but worth noting:** `yarn cedar setup
deploy vercel` (adds `vercel.json`, changes `cedar.toml`'s `apiUrl` to `/api`,
pushed as its own commit), and the repo went public at
[github.com/ad0maa/trainfuel](https://github.com/ad0maa/trainfuel).

**Still open from this phase:** a real job runner (backfill and the webhook both
process inline/fire-and-forget — same gap M1 left for recurrence materialization);
Google Calendar-style REST callback vs. the web-owned-redirect pattern used here
(now the established convention — Google Calendar in M5 should follow it too, not
the SPEC's original "web connect screen" REST assumption). Owner checklist items #2
(register a real Strava app) and #3 (pick hosting) are unblocked by this phase's
code but not yet done — the webhook and full end-to-end demo need them.

<details>
<summary>Original phase brief (kept for context — see DECISIONS.md "M3" for what actually shipped)</summary>

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

</details>

---

## Phase 3 (M4) — Hevy ✅ done (2026-07-23)

**Shipped:** `api/src/lib/integrations/{hevy,hevyIngest}.ts` (personal-API-key client
+ pure normalizer, +21 tests — no OAuth/refresh cycle, unlike Strava), `hevyPoll.ts`
(the poll job, doubling as the initial post-connect sync — Hevy's API has no
date-windowed backfill call the way Strava's does), `ingestHevyActivity` +
`deleteExternalActivity` added to `api/src/services/externalActivities/
externalActivities.ts` (+11 tests: exercise sync, idempotency, LIFT-not-RUN wiring,
deleted-event handling), `connectHevy` added to
`api/src/services/integrationAccounts/integrationAccounts.ts` (+5 tests),
`scripts/pollHevyWorkouts.ts`, and web: `HevyIntegrationCell` wired into
`SettingsPage`. `matching.ts`'s `compatibleScheduledItemType('strength') → 'LIFT'`
(built in M3 in anticipation of this) confirmed working as-is — matching engine
untouched. No schema migration needed (`IntegrationAccount.apiKey`, `Provider.HEVY`,
`ExternalActivity`/`ExternalExercise` were already in place from M0). Full project
suite: 30/30 test suites, 228/228 tests; lint and type-check clean. Hevy's actual API
was verified live (embedded OpenAPI spec extracted from its Swagger UI bundle, not
guessed) before writing any client code, per SPEC.md §9 — see DECISIONS.md "M4" for
the retrieval method and every confirmed endpoint shape/gap (notably: no calorie data
anywhere in Hevy's API, so lift `exerciseKcal` stays 0 unless the same session is also
logged to Strava; and `/v1/workouts` has no date filter at all, so the since-last-sync
mechanism SPEC.md §4.2 anticipated is actually `/v1/workouts/events?since=`, a
different endpoint). Owner checklist item #5 (Hevy Pro + API key) is still open — the
integration has never been exercised against a real account.

## Phase 4 (M7) — Polish ✅ done (2026-07-23, `trainfuel-cedar` PR #6)

**Shipped:** a persistent sidebar + topbar app shell (`web/src/layouts/MainLayout/`)
with a light/dark toggle, replacing every page's own header/nav; BMI and TDEE
calculator tools (TDEE backed by a new `tdeeEstimate` query reusing the existing
`api/src/lib/energy` module rather than reimplementing Mifflin-St Jeor client-side);
**Level 2 macro periodization** (SPEC.md §6.3) — new pure `dayType.ts`/
`level2Macros.ts` modules (fully unit tested) wired into `todayEnergySummary` and
`DailyEnergySummaryCell`, finally consuming the `prescription.isLongRun/isQualityRun`
flags M2.5 had been writing since the plan generator, unread, since it was built; and
the **Progress page** — new `dailyMetrics`/`liftActivities` queries plus a
`recharts`-based weight-trend chart (raw points + a simple EMA) and lift-progression
chart, with empty states, closing out CONSOLIDATION_PLAN's original "mini-M7 = Progress
page + empty states" fast-path target. Full rationale (including a couple of real bugs
hit and fixed along the way — an SDL backtick-in-description gotcha, a CedarJS gqlorm
type-name collision, a jsdom `matchMedia` guard) is in DECISIONS.md's "M7 — Polish"
section. Verified: 27/27 api test suites (241 tests) + 12/12 web suites (25 tests)
passing, both type-checks and lint clean.

**Still open from this phase:** none blocking — this was the last web/api-side gap
besides M5.

## Phase 5 (M6) — Mobile ✅ done (in the separate `trainfuel-mobile` repo)

Per SPEC.md §2's decision to keep mobile out of this monorepo (Expo's React 19/
TypeScript ~6 requirement conflicts with this repo's React 18/TypeScript 5.9 pin —
see DECISIONS.md "Mobile bearer auth (foundation for M6)"), M6 shipped entirely in
[`trainfuel-mobile`](https://github.com/ad0maa/trainfuel-mobile), not here:

- **This repo's contribution:** two additive backend endpoints on `feature/mobile-app`
  (merged to `main` via PR #5) — `foodByBarcode` (SPEC.md §4.4's OFF barcode flow,
  deferred since M2) and `syncHealthSamples` (SPEC.md §4.5's HealthKit ingestion,
  dedup on HealthKit UUID, folding `BODY_MASS` samples into `DailyMetric.weightKg`).
  No schema migration needed — both models existed since M0.
- **`trainfuel-mobile`'s own build** (its PR #1): Today/tick, Diary, Activities, Plan,
  and Settings screens with Expo Router; recent/frequent quick-log (no backend change
  needed — `searchFoods` already returned it, mobile just hadn't surfaced it); an
  offline mutation queue (`@react-native-async-storage/async-storage`); local
  notifications for meds/supps/session reminders (`expo-notifications`); real barcode
  scan → `foodByBarcode` lookup; HealthKit weight/active-energy sync → `syncHealthSamples`;
  and the Cyan Steel design system (NativeWind mapping) applied throughout. Auth is a
  `mobileLogin` bearer-token flow against the same `hashedPassword`/`salt` dbAuth
  already writes (see that repo's README for the full architecture table).
- **Still open:** HealthKit requires a real `expo-dev-client` build against a real
  Apple Developer account (owner checklist #7) — the sync code exists and is wired,
  but per SPEC.md §2 hasn't been exercised on a real device/entitlement yet. No
  refresh-token rotation on the 30-day mobile bearer token (deferred, not forgotten,
  per DECISIONS.md).

## Phase 6 — remaining SPEC milestone

- **M5 Google Calendar** (push/patch/delete, reminder offsets, nightly reconcile) —
  the only milestone left unbuilt from SPEC.md's M0–M7 ladder. Blocked on owner
  checklist #6 (a Google Cloud project + OAuth consent screen); "testing" publish
  status is fine per SPEC.md §10. Per Phase 2's note, follow the web-owned-redirect
  OAuth pattern established for Strava/Hevy here, not SPEC's original "REST callback"
  assumption. No job runner exists yet for the nightly reconcile job — same
  fire-and-forget gap M1/M3/M4 already left open; decide alongside a real hosting-
  platform scheduled-job mechanism if this becomes a live pain point (Vercel is
  already the deploy target — see Phase 2's note — so a Vercel Cron Job is the most
  likely fit).

## Phase F — fast-path cut line (superseded — the ship line was crossed and then some)

Original goal: **Ship = Phase 0 → M2.5 → M3 → mini-M7 (Progress page + empty
states) → deploy.** That line was crossed at M3 (deployed to Vercel, public repo,
real users hit it — see DECISIONS.md "Post-deploy fixes"), and everything originally
deferred past it (M4 Hevy, M6 Mobile, full M7) has since shipped too. Only M5
(Calendar) remains, and it was never on the fast-path's critical line to begin with —
picking it up now is a "keep going," not a "reopen a cut corner."

---

## Owner checklist (things only a human can do)

| # | Item | Status |
|---|---|---|
| 1 | Run `yarn cedar test` once locally (consent for test-DB reset) | ✅ done (Phase 0) |
| 2 | Register a Strava API application (client id/secret, callback domain) | ⬜ still open as of the last deploy check (Settings showed "Strava isn't configured on this deployment yet") — **confirm if this has been done since**, it's the one item this file can't verify from git alone |
| 3 | Choose hosting + provision Postgres; set the public webhook URL | ✅ done — deployed to Vercel, repo public at github.com/ad0maa/trainfuel, real users hit it in production (see DECISIONS.md "Post-deploy fixes") |
| 4 | Real product name (or ship as TrainFuel) | ⬜ still shipping as "TrainFuel" placeholder |
| 5 | Hevy Pro + API key | ⬜ still open — M4's integration is fully built and tested against Hevy's live API contract, but never exercised against a real account |
| 6 | Google Cloud project + OAuth consent screen | ⬜ still open — **blocks M5**, the only remaining milestone |
| 7 | Apple Developer account (HealthKit entitlement) | ⬜ still open — M6 shipped (see Phase 5) with HealthKit sync code wired, but it needs a real `expo-dev-client` build against a real entitlement to actually exercise on-device |

## DECISIONS.md entries written so far (all ✅, historical record)

- Phase mapping `base/peak → REBUILD/BUILD` (no enum extension) + Monday-anchor +
  07:00 local default start time for generated sessions. ("M2.5 — Plan generator")
- Plan generator ported from the `health` repo's Django implementation (provenance
  note + what was dropped: Plan/PlanWeek/PlanSession models, fuzzy dedup). ("M2.5")
- `weeklyWeightDeltaKg` clamp values — implemented in the "Missing Profile UI"
  post-deploy fix, not M2.5 itself (that phase needed no schema/write-path change).
- Backfill window (30 days per SPEC, diverging from donor's full history). ("M3")
- App-shell/theme/Level-2-macros/Progress-page decisions. ("M7 — Polish")

**Not yet written to DECISIONS.md** (shipped on other branches/repos without a
matching write-up here — a gap, not a blocker):
- Background-job mechanism for M3/M4/M5's fire-and-forget gaps — never actually
  resolved; still an open design question whenever a real scheduler gets picked.
- The `feature/mobile-app` branch's `foodByBarcode`/`syncHealthSamples` additions
  (Phase 5) have no DECISIONS.md section in this repo.
- `trainfuel-mobile`'s own build decisions live only in that repo's README.md/
  CLAUDE.md, not here — worth cross-linking if this file is meant to be the single
  status source of truth going forward.
