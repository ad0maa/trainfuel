# TrainFuel — Product & Technical Specification

> **Audience:** This spec is written for an AI coding agent (Claude Code) implementing the project, working with a senior full-stack developer (the product owner). Follow the conventions and build order below. When a decision is ambiguous, prefer the simpler option and flag the decision in a `DECISIONS.md` file at the repo root rather than blocking.

**Working name:** TrainFuel (placeholder — trivial to rename, keep branding out of code identifiers)

**One-line pitch:** A one-stop marathon training + nutrition platform: structured training plans (Runna-style) + calorie/macro tracking (Cronometer/MyFitnessPal-style) + automatic completion tracking from Strava/Hevy/HealthKit — connected in a single feedback loop none of those products provide.

**Primary user (v1):** Single user — the product owner. A 34M recreational runner/lifter in Australia training for half/full marathons. Multi-user is a v2+ concern, but do not hard-code single-user assumptions into the schema (see Data Model).

---

## 1. Goals & Non-Goals

### v1 (MVP) Goals
1. Plan training as **blocks** (rebuild/build/taper) that generate scheduled **sessions** (runs, lifts).
2. Push scheduled sessions to **Google Calendar**; keep calendar in sync when sessions change.
3. **Auto-tick** completed sessions: runs via Strava webhook, lifts via Hevy API polling, with manual tick/override always available.
4. **Food logging** with an Australian-quality food database (AFCD seed + Open Food Facts barcode fallback), daily calorie + macro targets.
5. **Dynamic TDEE** — Levels 1 & 2 (see §6): expenditure-adjusted daily targets + planned-session carb periodization.
6. **React Native app** (Expo): HealthKit sync (body weight, active energy), tick-off UI, barcode scanner, local notifications for sessions/medications/supplements.
7. **Web app**: dashboard, block/session planning, food logging, progression charts.
8. **Medication/supplement reminders** as first-class scheduled items with tick-off.

### v2 (design for, don't build)
- Adaptive TDEE from energy balance (Level 3, §6.4) — **schema must support this from day one**.
- Readiness score (HRV / resting HR / sleep from HealthKit) + adaptive session suggestions.
- Acute:chronic workload ratio (ACWR) chart with danger band.
- Hevy routine **push** (v1 is read-only ingest).
- LLM coach endpoint (weekly actuals → suggested plan adjustments via Claude API).
- Photo-based food logging (vision model estimate).
- Multi-user auth hardening, OAuth-style credential management for integrations.

### Non-Goals (any version, for now)
- Social features, sharing, feeds.
- Pushing structured interval workouts to Apple Watch (WorkoutKit) — handled outside the app for now.
- Android HealthConnect (iOS-first; keep the health-data ingestion API platform-agnostic so Android can be added).
- Wearable app.

---

## 2. Architecture & Stack

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Web (React │     │   CedarJS API     │     │  Postgres    │
│  Cedar      │────▶│   GraphQL + Prisma│────▶│              │
│  web side)  │     │   + bg jobs       │     └─────────────┘
└─────────────┘     └───┬────┬────┬────┘
                        │    │    │
┌─────────────┐         │    │    │
│  Mobile     │─────────┘    │    └── Outbound: Google Calendar API
│  (Expo RN)  │              └── Inbound: Strava webhook, Hevy poll,
│  HealthKit  │                  Open Food Facts, USDA FDC
└─────────────┘
```

- **Monorepo:** CedarJS project with the Expo app added as an additional workspace (`apps/mobile` or Cedar-conventional location). Web + API stay in standard Cedar `web/` and `api/` sides.
- **Framework:** [CedarJS](https://cedarjs.com) — the actively-maintained community continuation of classic RedwoodJS (React + GraphQL + Prisma + cells/services/SDL/dbAuth conventions), chosen over RedwoodJS itself (winding down) and over RedwoodSDK (a different, RSC/Cloudflare-oriented framework with no GraphQL layer, incompatible with this spec's architecture). CLI commands are unchanged from Redwood (`yarn rw generate ...` / `yarn cedar generate ...` are aliases). Use the current stable major at build time and **record the exact chosen version in `DECISIONS.md`.**
- **API:** GraphQL (Cedar services + SDL). The mobile app consumes the same GraphQL API as web.
- **DB:** Postgres. Prisma schema is the single source of truth for the data model.
- **Auth:** Cedar dbAuth for v1 (single user, simplest path). Structure services so swapping to Clerk/Supabase later is contained. Mobile authenticates against the same auth with a session token; if dbAuth cookie flow is awkward from RN, implement a simple bearer-token strategy on top (document in `DECISIONS.md`).
- **Background jobs:** Cedar's background jobs / scheduled functions for Hevy polling and calendar sync reconciliation. If self-hosting complexity is an issue, a simple `node-cron` worker process is acceptable for v1.
- **Mobile:** Expo (managed workflow where possible). HealthKit requires a dev build (`expo-dev-client`) — that's fine. Libraries: `@kingstinct/react-native-healthkit` or `react-native-health` (evaluate current maintenance status at build time), `expo-notifications` (local only), `expo-camera` / `expo-barcode-scanner` for barcode.
- **Hosting (v1):** anything simple — Cedar deploy target of owner's choice (e.g. a VPS/Fly/Render + managed Postgres). Not a blocker; make no host-specific assumptions in code. The Strava webhook needs a public HTTPS endpoint.

### Agent guidance — stack
- Do **not** eject from Cedar conventions (cells, services, directives) — the owner knows this framework; conventional code is more maintainable for them than clever code.
- Keep every external integration behind a service-layer interface (`api/src/lib/integrations/strava.ts`, `hevy.ts`, `googleCalendar.ts`, `foodSources/`). No fetch calls to third parties from resolvers directly.
- All secrets via env vars; ship a complete `.env.example`. Never commit real keys.
- TypeScript everywhere, strict mode.

---

## 3. Data Model

Prisma-style outline (agent: convert to a real `schema.prisma`; add createdAt/updatedAt everywhere; use cuid/uuid ids; add indexes noted below).

### 3.1 Core identity & profile

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  hashedPassword String
  salt          String
  profile       Profile?
  // relations: blocks, scheduledItems, foodLogs, bodyMetrics, integrationAccounts...
}

model Profile {
  id          String  @id @default(cuid())
  userId      String  @unique
  sex         Sex               // MALE | FEMALE
  birthDate   DateTime
  heightCm    Float
  // goal config
  goalWeightKg     Float?
  weeklyWeightDeltaKg Float?    // e.g. -0.4 for deficit pacing
  activityBaseline ActivityBaseline @default(SEDENTARY) // used only as the non-exercise base, see §6
  proteinTargetGPerDay Float?   // explicit override; else computed
  timezone    String @default("Australia/Melbourne")
}
```

> Even though v1 is single-user, **every domain row carries `userId`**. This costs nothing now and makes multi-user a migration-free upgrade.

### 3.2 Training plan structure

```prisma
model TrainingBlock {
  id        String @id @default(cuid())
  userId    String
  name      String            // "Geelong HM — Build"
  phase     BlockPhase        // REBUILD | BUILD | TAPER | MAINTENANCE
  startDate DateTime
  endDate   DateTime
  notes     String?
  sessions  ScheduledItem[]
}

model ScheduledItem {
  id         String   @id @default(cuid())
  userId     String
  blockId    String?           // null for standalone items (meds, ad-hoc sessions)
  type       ScheduledItemType // RUN | LIFT | MEDICATION | SUPPLEMENT | OTHER
  title      String            // "W4 Tue: 6×800m intervals" / "Creatine 5g"
  description String?          // full prescription text (paces, sets/reps, dose)
  scheduledAt DateTime          // tz-aware; the planned start
  durationMin Int?
  // recurrence for meds/supps (sessions are generated concretely, not recurring)
  recurrenceRule String?        // RFC5545 RRULE string, null for one-off
  status     ItemStatus @default(PLANNED) // PLANNED | COMPLETED | SKIPPED | MOVED
  // prescription payload, type-specific (run pace targets, lift exercise list, dose mg)
  prescription Json?
  // calendar sync
  gcalEventId String?
  gcalSyncedAt DateTime?
  completion  Completion?
  @@index([userId, scheduledAt])
  @@index([userId, type, status])
}
```

**Design rule:** meds/supps and workouts share `ScheduledItem` — same tick-off, same notification pipeline. Recurring meds use `recurrenceRule` and are *materialized* into concrete daily rows by a nightly job for the next 14 days (keeps queries and ticking dead simple; avoid on-the-fly recurrence math in the read path).

### 3.3 Completion & external activity ingestion

```prisma
model Completion {
  id               String @id @default(cuid())
  scheduledItemId  String @unique
  userId           String
  completedAt      DateTime
  source           CompletionSource // STRAVA | HEVY | HEALTHKIT | MANUAL
  matchConfidence  MatchConfidence @default(EXACT) // EXACT | FUZZY | MANUAL
  externalActivityId String?       // FK to ExternalActivity
  notes            String?         // "hammy tight last 2km"
}

model ExternalActivity {
  id          String @id @default(cuid())
  userId      String
  source      CompletionSource   // STRAVA | HEVY | HEALTHKIT
  externalId  String             // provider's id
  activityType String            // Run, WeightTraining, ...
  startedAt   DateTime
  durationSec Int?
  distanceM   Float?
  energyKcal  Float?             // provider-reported, raw (haircut applied at calc time, not storage)
  raw         Json               // full provider payload — always store
  // Hevy detail lives in raw + normalized children:
  exercises   ExternalExercise[]
  @@unique([source, externalId])
  @@index([userId, startedAt])
}

model ExternalExercise {           // normalized Hevy sets for progression charts
  id         String @id @default(cuid())
  activityId String
  name       String               // "Leg Press"
  order      Int
  sets       Json                 // [{reps, weightKg, rpe?}, ...]
}
```

**Matching logic (the auto-tick engine, `api/src/lib/matching.ts`):**
1. On new `ExternalActivity`, look for a `PLANNED` `ScheduledItem` of compatible type (`Run`→RUN, `WeightTraining`→LIFT) on the same local calendar day for that user.
2. Exactly one candidate → complete it, `matchConfidence: EXACT`.
3. Multiple candidates → nearest `scheduledAt`; mark `FUZZY` and surface in UI as "auto-matched — confirm?".
4. Zero candidates → leave the activity unmatched; UI shows it in an "unplanned activity" tray where the user can link or ignore.
5. Manual tick always allowed; manual tick beats and cannot be overwritten by later auto-matching.
6. Idempotency: matching keyed on `ExternalActivity.id`; re-processing the same activity must be a no-op.

### 3.4 Nutrition

```prisma
model Food {
  id          String @id @default(cuid())
  name        String
  brand       String?
  source      FoodSource  // AFCD | OFF | USDA | CUSTOM
  externalId  String?     // AFCD key / OFF barcode / FDC id
  barcode     String?     @index
  // canonical nutrients PER 100 g (or per 100 ml, flagged)
  per100      Json        // { kcal, proteinG, carbsG, fatG, fibreG?, sugarG?, sodiumMg?, ... }
  isLiquid    Boolean @default(false)
  servings    FoodServing[]
  verified    Boolean @default(false) // AFCD/USDA true; OFF false until user-confirmed
  createdByUserId String?             // for CUSTOM
  @@unique([source, externalId])
}

model FoodServing {
  id      String @id @default(cuid())
  foodId  String
  label   String   // "1 slice", "1 cup cooked", "1 scoop"
  grams   Float
}

model FoodLogEntry {
  id        String @id @default(cuid())
  userId    String
  foodId    String
  loggedFor DateTime  // the DAY it counts toward (local date, store as date)
  meal      MealSlot  // BREAKFAST | LUNCH | DINNER | SNACK
  quantity  Float     // number of servings OR grams
  unit      LogUnit   // SERVING | GRAM
  servingId String?   // required when unit = SERVING
  // denormalized computed nutrients at log time (immutable snapshot —
  // protects history if the Food row is later corrected)
  nutrients Json
  @@index([userId, loggedFor])
}

model Recipe {              // saved meals — "my usual breakfast"
  id      String @id @default(cuid())
  userId  String
  name    String
  items   Json              // [{foodId, quantity, unit, servingId?}]
}
```

**Canonical rule: everything normalizes to per-100g internally.** Serving sizes are just gram multipliers. This kills the unit-conversion bug class. Log entries snapshot computed nutrients (denormalized) so historical days never change retroactively.

### 3.5 Daily rollups (required for TDEE Level 3 later)

```prisma
model DailyMetric {
  id        String @id @default(cuid())
  userId    String
  date      DateTime          // local date
  weightKg  Float?            // latest HealthKit weight for the day
  intakeKcal Float?           // rolled up from FoodLogEntry
  intakeProteinG Float?
  intakeCarbsG  Float?
  intakeFatG    Float?
  exerciseKcalRaw Float?      // sum of provider-reported exercise energy
  activeEnergyKcalRaw Float?  // HealthKit active energy (whole-day)
  targetKcal Float?           // what the app told the user that day (audit trail)
  targetProteinG Float?
  targetCarbsG Float?
  targetFatG   Float?
  @@unique([userId, date])
}
```

A nightly job (and on-write triggers where cheap) maintains this table. **This is the substrate for v2 adaptive TDEE — build it in v1 even though v1 only reads it for charts.**

### 3.6 Integrations & health ingestion

```prisma
model IntegrationAccount {
  id        String @id @default(cuid())
  userId    String
  provider  Provider  // STRAVA | HEVY | GOOGLE_CALENDAR
  // Strava/Google: OAuth tokens. Hevy: personal API key.
  accessToken  String?   // encrypt at rest (see security note)
  refreshToken String?
  expiresAt    DateTime?
  apiKey       String?
  scope        String?
  meta         Json?     // athlete id, calendar id, etc.
  @@unique([userId, provider])
}

model HealthSample {       // raw HealthKit ingestion from mobile
  id        String @id @default(cuid())
  userId    String
  kind      HealthKind // BODY_MASS | ACTIVE_ENERGY | RESTING_HR | HRV | SLEEP (v2 kinds fine to enumerate now)
  value     Float
  unit      String
  sampledAt DateTime
  sourceId  String     // HealthKit UUID — dedupe key
  @@unique([userId, kind, sourceId])
  @@index([userId, kind, sampledAt])
}
```

**Security note (agent must implement):** encrypt `accessToken`/`refreshToken`/`apiKey` at rest (libsodium/`crypto` AES-GCM with a key from env). Never return raw tokens through GraphQL. Redact tokens from all logs.

---

## 4. External Integrations

### 4.1 Strava (runs in — webhook)
- OAuth2 flow (web-side connect screen). Scopes: `activity:read_all`. Store athlete id in `IntegrationAccount.meta`.
- **Webhook:** implement Strava's push subscription (single Cedar function endpoint handling the GET validation challenge + POST events). On `create`/`update` of an activity → fetch full activity via API → upsert `ExternalActivity` → run matching engine.
- **Backfill:** on first connect, pull the last 30 days of activities.
- Token refresh: Strava tokens are short-lived; refresh proactively in the integration client, not in callers.
- Rate limits exist (per-15-min and daily); the client must handle 429 with backoff. Verify current limit values from Strava docs at build time.

### 4.2 Hevy (lifts in — poll)
- Personal API key (requires Hevy Pro). Settings screen accepts and stores the key (encrypted).
- **Poll:** scheduled job every 15 min: `GET /v1/workouts` (paginated, since-last-sync using workout dates and a stored cursor/timestamp in `IntegrationAccount.meta`). Upsert `ExternalActivity` (+ `ExternalExercise` children) → matching engine.
- v1 is **read-only**. Structure the client so `POST /v1/routines` (v2 push) is an additive method.
- Verify current endpoint paths/shapes against Hevy's public API docs at build time — do not code from memory.

### 4.3 Google Calendar (sessions out)
- OAuth2 (web connect screen), scope `calendar.events` limited to a dedicated calendar. On first connect, create (or let user pick) a dedicated calendar; store its id in `meta`. **Never write to the user's primary calendar.**
- Sync rules:
  - `ScheduledItem` created/updated with type RUN|LIFT → create/patch event; store `gcalEventId`.
  - Item deleted/SKIPPED-in-advance → delete event.
  - Reminders: relative popup offsets computed so the alert fires at 06:30 local on the event day (offset = minutes between 06:30 and event start; 0 if event starts 06:30 or earlier). Recompute offsets whenever `scheduledAt` changes.
  - Use explicit `timeZone` from `Profile.timezone` on every event.
  - Event color: distinguish RUN vs LIFT (colorId mapping constant).
- Meds/supps do **not** go to calendar (local notifications only) unless a per-item `pushToCalendar` flag is set.
- Sync is **one-directional (app → calendar)** in v1. A nightly reconcile job re-pushes any item whose `updatedAt > gcalSyncedAt` and flags orphaned/manually-deleted events rather than silently recreating them.

### 4.4 Food data sources
- **AFCD (seed):** download the FSANZ Australian Food Composition Database release file (xlsx/csv). Write a one-off idempotent seed script (`yarn rw exec seedAfcd`) mapping to `Food` rows (`source: AFCD`, per-100g nutrients, `verified: true`). Include the AFCD release version in `DECISIONS.md`. Add sensible default `FoodServing`s only where the dataset provides measures; otherwise gram-only is fine.
- **Open Food Facts (barcode + packaged search):** live lookup `GET https://world.openfoodfacts.org/api/v2/product/{barcode}` on scan miss in local DB → validate required nutrients present (kcal + macros per 100g) → cache into `Food` (`source: OFF`, `verified: false`). Show an "unverified — check label" hint until the user confirms/edits once. Respect OFF's user-agent requirement. ODbL licence: keep OFF-derived rows attributable (`source` + `externalId` suffice).
- **USDA FDC (fallback search, optional in v1):** behind the same `FoodSource` interface; implement the interface, stub the provider if time-boxed.
- **Search order:** local `Food` table (Postgres `pg_trgm` ILIKE/similarity + recent/frequent boost) → OFF (packaged/barcode) → USDA. Every external hit is cached locally; the local DB is the system of record.
- **Recent/frequent:** query over `FoodLogEntry` (last 90 days, frequency-weighted) — this is the top of every search UI. Users log the same ~30 foods repeatedly; optimize for that.

### 4.5 HealthKit (mobile → API)
- Read permissions v1: body mass, active energy burned. (Request-only-what's-used; add HRV/RHR/sleep kinds in v2.)
- Mobile syncs on app foreground + a background task where Expo allows: query samples since last anchor, POST batch to a `syncHealthSamples` mutation. Dedupe server-side on HealthKit UUID.
- Body mass flows into `DailyMetric.weightKg` (latest sample per local day).
- **Do not treat HealthKit active energy + Strava calories as additive** — Strava run calories are typically *contained in* the day's active energy (both originate from the watch). See §6.2.

---

## 5. Auto-tick & Notification Behaviour

- **Runs:** Strava webhook → usually ticked within a minute of upload. UI shows source badge ("via Strava").
- **Lifts:** Hevy poll → ticked within ≤15 min. Progression data (sets/reps/weight per exercise) attached to the completion for charts.
- **Manual:** every `ScheduledItem` has a one-tap tick in both apps; manual completions store `source: MANUAL` and are never overwritten.
- **Meds/supplements:** local notifications from the RN app at the item's scheduled time (materialized daily rows, §3.2). Tick from the notification action where the platform allows, else from the app's Today screen. Missed items roll to a "missed" state at end of local day (job), visible but not nagging.
- **Session reminders:** optional local notification N minutes before `scheduledAt` (per-type default, per-item override).

---

## 6. TDEE & Daily Targets (MVP: Levels 1 + 2)

All formulas in one pure, unit-tested module: `api/src/lib/energy/`. No side effects; takes profile + day inputs, returns targets. This module is the most test-worthy code in the app.

### 6.1 BMR
Mifflin-St Jeor:
- male: `BMR = 10*weightKg + 6.25*heightCm − 5*age + 5`
- female: `… − 161`
- `weightKg` = most recent smoothed weight (v1: latest `DailyMetric.weightKg`, falling back to profile-entered weight; v2 swaps in EMA-smoothed trend weight with no interface change).

### 6.2 Level 1 — expenditure-adjusted daily target
```
baseTDEE   = BMR * baselineMultiplier        // SEDENTARY 1.2 … from Profile.activityBaseline
exerciseKcal = deviceHaircut * max(strravaAndHevyExerciseKcalForDay, 0)
             // deviceHaircut default 0.75, configurable constant — device estimates run hot
dayTDEE    = baseTDEE + exerciseKcal
targetKcal = dayTDEE + weeklyWeightDeltaKg * 7700 / 7   // deficit/surplus pacing
```
- **Double-count guard:** exercise kcal comes from `ExternalActivity.energyKcal` (Strava runs, Hevy lifts). Ignore HealthKit whole-day active energy in this formula in v1 (it overlaps Strava). Store both; reconcile properly in v2.
- Targets recompute live during the day as activities land (“you ran — +410 kcal available”). Persist the end-of-day final target into `DailyMetric.targetKcal`.
- Guardrail: floor `targetKcal` at `BMR * 1.0`; never advise eating below BMR. Surface a gentle note if the configured deficit would breach it.

### 6.3 Level 2 — planned-session macro periodization
Macros from `targetKcal`:
1. **Protein:** `Profile.proteinTargetGPerDay` if set, else `2.0 g/kg` of current weight.
2. **Carbs by day type**, derived from *planned* `ScheduledItem`s for the date:
   - LONG_RUN day (RUN with `prescription.isLongRun` or duration ≥ 75 min): carbs `5 g/kg`
   - QUALITY_RUN day (intervals/tempo flag): carbs `4 g/kg`
   - other RUN or LIFT day: `3 g/kg`
   - rest day: `2.5 g/kg`
3. **Fat:** remainder of kcal after protein+carbs (floor at `0.6 g/kg`; if breached, reduce carbs tier by 0.5 g/kg steps).
- Day type is computed from the plan the **night before** (so morning targets are stable), recomputed only if the user edits that day's sessions.

### 6.4 Level 3 (v2 — do not build, do not block)
Adaptive TDEE inferred from 14–21 day regression of `intakeKcal` vs smoothed `weightKg` trend (`DailyMetric`). v1's only obligation: keep `DailyMetric` complete and correct.

---

## 7. Application Surfaces

### 7.1 Web (Cedar web side)
Primary planning + analysis surface. Screens:
1. **Dashboard (Today):** today's sessions with tick state + source badges; calories/macros ring vs target (live Level 1 number); quick-add food; unmatched-activity tray.
2. **Plan:** block list + calendar-style week view of `ScheduledItem`s; create/edit blocks; generate sessions within a block (manual creation in v1 — template auto-generation is a stretch goal); drag/move sessions (updates calendar).
3. **Food log:** per-day, grouped by meal slot; search (recent/frequent first), barcode field (manual entry on web), recipes/saved meals; daily totals vs targets.
4. **Progress:** weight chart (raw points + trend line — simple EMA fine in v1); lift progression per exercise (from `ExternalExercise`); weekly run volume.
5. **Settings:** profile & goals; integration connect/disconnect (Strava OAuth, Google OAuth, Hevy key); food-source preferences.

Use the `frontend-design` skill guidance when building UI. Charts: Recharts or similar — pick one, record in `DECISIONS.md`.

### 7.2 Mobile (Expo RN)
Thin, fast, offline-tolerant. Screens:
1. **Today:** sessions + meds/supps tick list; calorie/macro ring; "log food" and "scan barcode" actions.
2. **Scanner:** camera barcode → local lookup → OFF fallback → quantity → log.
3. **Quick log:** recent/frequent foods, recipes.
4. **Settings:** HealthKit permissions & sync status, notification preferences, sign in.
- **Offline:** queue mutations (ticks, food logs) locally (simple persisted queue — `AsyncStorage`/MMKV — full sync-DB like WatermelonDB is overkill for v1) and flush on reconnect. Reads may be stale-while-revalidate cached.
- No planning/analysis on mobile in v1.

---

## 8. Build Order (agent: implement as milestones; each ends green-tested and demoable)

**M0 — Scaffold.** Cedar app + Prisma schema (§3 in full, including v2-supporting tables) + dbAuth + seed script skeleton + CI (typecheck, lint, test). `.env.example`. `DECISIONS.md` started.

**M1 — Plan & tick (no integrations).** TrainingBlock/ScheduledItem CRUD, meds recurrence materialization job, manual completion. Web Dashboard + Plan screens. Unit tests for recurrence materialization.

**M2 — Food core.** AFCD seed, Food/serving/log models + services, search (trgm + recent/frequent), web Food log screen, `DailyMetric` rollups. Energy module (§6) with full unit tests; static targets displayed (Level 1 without live exercise yet).

**M3 — Strava.** OAuth connect, webhook endpoint + validation, backfill, matching engine (all six rules of §3.3 unit-tested), live Level 1 target updates. Unmatched-activity tray.

**M4 — Hevy.** Key storage, poll job, ExternalExercise normalization, lift auto-tick, lift progression chart.

**M5 — Google Calendar.** OAuth, dedicated calendar, push/patch/delete sync, reminder offsets, nightly reconcile.

**M6 — Mobile.** Expo app: auth, Today screen with ticks, food quick-log + barcode scan (OFF fallback), HealthKit weight + active energy sync, local notifications for meds/supps/sessions, offline mutation queue.

**M7 — Polish.** Progress screens, Level 2 periodized macros wired to plan, weight trend line, empty/error states, settings completeness.

Ship = end of M7.

---

## 9. Conventions & Quality Bar (agent directives)

- **Tests:** the energy module, matching engine, recurrence materialization, and nutrient-normalization math require unit tests (these are the bug-prone pure-logic cores). Services get scenario tests per Cedar convention. Don't chase coverage % elsewhere.
- **Dates/timezones:** store UTC instants for `scheduledAt`/`sampledAt`; store *local dates* (date-only) for `loggedFor`/`DailyMetric.date`, derived using `Profile.timezone`. All "day boundary" logic goes through one `localDay(userId, instant)` helper. Timezone bugs are the #1 predicted defect class in this app — be paranoid here.
- **Idempotency everywhere data enters:** webhook redelivery, poll overlap, health-sample re-sync, and seed re-runs must all be safe no-ops (`@@unique` constraints + upserts, as specified).
- **External API shapes:** verify current Strava/Hevy/OFF/Google endpoint contracts from their live docs at build time; do not rely on memorized shapes. Record versions/links in `DECISIONS.md`.
- **Migrations:** every schema change via Prisma migrate; never `db push` past M0.
- **Error surfacing:** integration failures (expired token, Hevy 401, calendar quota) must set a visible per-integration status in Settings, not just log.
- **No premature abstraction:** single-user v1; `userId` plumbed everywhere but no org/teams/roles machinery.
- **When blocked or ambiguous:** choose the simpler interpretation, note it in `DECISIONS.md`, keep moving. Only stop for decisions with data-loss or security implications.

---

## 10. Open Items (owner input needed before/around M0)

1. Real product name (repo can start as `trainfuel`).
2. Hosting target (affects webhook URL for Strava during dev — use a tunnel like `cloudflared`/`ngrok` in the meantime).
3. Hevy Pro subscription + API key (needed by M4).
4. Google Cloud project + OAuth consent screen (needed by M5; "testing" publish status is fine for personal use).
5. Strava API application registration (needed by M3).
6. Apple Developer account for the Expo dev build with HealthKit entitlement (needed by M6).
