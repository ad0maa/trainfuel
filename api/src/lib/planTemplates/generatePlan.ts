// SPEC.md §7.1 calls a plan generator a stretch goal; CONSOLIDATION_PLAN.md
// Phase 1 (M2.5) ports the donor Django repo's implementation
// (`health/backend/apps/plans/engine.py`) as a pure TS function, matching
// M1's `materializeRecurringItems.ts` pure-core/thin-shell pattern: this
// module takes plain inputs and returns plain data — no DB access, fully
// unit-testable. The caller (the `generateTrainingPlan` service) is
// responsible for persisting the returned blocks/sessions as
// TrainingBlock/ScheduledItem rows.
//
// See DECISIONS.md "M2.5 — Plan generator" for the phase-mapping,
// Monday-anchoring, and default-session-time decisions made while porting.

import {
  addLocalDays,
  localDateToUtcMidnight,
  localDayBoundsUtc,
} from 'src/lib/date/localDay'
import type { BlockPhase, ScheduledItemType } from 'src/lib/db'

import type {
  GoalType,
  PlanPhase,
  SessionType,
  TemplateWeek,
} from './templates'
import { PLAN_TEMPLATES } from './templates'

// ─────────────────────────────────────────────────────────────────────────
// Entry-week selection & feasibility (ported from engine.py 1:1)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Return the last week whose targetVolumeKm does not exceed currentWeeklyKm.
 * Never places the user in the taper — caps at the last peak week. Falls
 * back to week 1 if the user is below every template volume.
 */
export function findEntryWeek(
  weeks: readonly TemplateWeek[],
  currentWeeklyKm: number
): TemplateWeek {
  const nonTaper = weeks.filter((week) => week.phase !== 'taper')
  const eligible = nonTaper.filter(
    (week) => week.targetVolumeKm <= currentWeeklyKm
  )
  return eligible.length > 0 ? eligible[eligible.length - 1] : nonTaper[0]
}

export interface FeasibilityResult {
  isFeasible: boolean
  weeksRemaining: number
  /** Local calendar date (YYYY-MM-DD). */
  suggestedGoalDate: string
  message: string
}

function formatDateForMessage(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(localDateToUtcMidnight(dateStr))
}

/**
 * Given the entry week and a goal date, decides whether there is enough
 * time to complete the remaining plan weeks. Returns a warning result
 * (never throws) so the caller can surface it to the user rather than
 * silently producing an unsafe progression — SPEC.md's feasibility gate.
 */
export function checkFeasibility(
  goalType: GoalType,
  entryWeekNo: number,
  startDate: string,
  goalDate: string
): FeasibilityResult {
  const weeks = PLAN_TEMPLATES[goalType]
  const weeksRemaining = weeks.length - entryWeekNo + 1
  const suggestedGoalDate = addLocalDays(startDate, weeksRemaining * 7)

  if (goalDate < suggestedGoalDate) {
    return {
      isFeasible: false,
      weeksRemaining,
      suggestedGoalDate,
      message:
        `Your goal date is too soon for a safe progression. Based on your ` +
        `current fitness, a realistic target is ${formatDateForMessage(suggestedGoalDate)} ` +
        `(${weeksRemaining} weeks away).`,
    }
  }

  return {
    isFeasible: true,
    weeksRemaining,
    suggestedGoalDate,
    message: 'Goal date is achievable.',
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Template → TrainingBlock/ScheduledItem mapping (new in the port — the
// donor persisted its own Plan/PlanWeek/PlanSession models, which this repo
// doesn't have; see CONSOLIDATION_PLAN.md's schema-mapping section)
// ─────────────────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<GoalType, string> = {
  c25k: 'Couch to 5K',
  '5k': '5K',
  '10k': '10K',
  '21k': 'Half Marathon',
}

/**
 * base/build/peak all map onto existing BlockPhase values without extending
 * the enum (build and peak both become BUILD — the human-readable
 * distinction survives in the block name, e.g. "5K — Peak"). See
 * DECISIONS.md.
 */
const PHASE_TO_BLOCK_PHASE: Record<PlanPhase, BlockPhase> = {
  base: 'REBUILD',
  build: 'BUILD',
  peak: 'BUILD',
  taper: 'TAPER',
}

const PHASE_LABEL: Record<PlanPhase, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
}

const DAY_ABBR = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  walk_run: 'Walk/Run',
  easy: 'Easy Run',
  long: 'Long Run',
  tempo: 'Tempo Run',
  interval: 'Interval Run',
}

/** Default local time of day for generated sessions (07:00), added to local midnight. */
const DEFAULT_SESSION_START_OFFSET_MS = 7 * 60 * 60 * 1000

/** ISO weekday of a `YYYY-MM-DD` string: 1=Mon…7=Sun (matches TemplateSession.day). */
function isoWeekday(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0=Sun...6=Sat
  return jsDay === 0 ? 7 : jsDay
}

/** The Monday on or after `dateStr` — pure calendar-string math, no timeZone needed. */
function firstMondayOnOrAfter(dateStr: string): string {
  const weekday = isoWeekday(dateStr)
  return addLocalDays(dateStr, (8 - weekday) % 7)
}

/** Splits a week sequence into contiguous runs sharing the same template `phase`. */
function segmentByPhase(weeks: readonly TemplateWeek[]): TemplateWeek[][] {
  const segments: TemplateWeek[][] = []
  for (const week of weeks) {
    const last = segments.at(-1)
    if (last && last[0].phase === week.phase) {
      last.push(week)
    } else {
      segments.push([week])
    }
  }
  return segments
}

export interface GeneratedSession {
  type: ScheduledItemType
  title: string
  description: string
  /** UTC instant. */
  scheduledAt: Date
  durationMin: number | null
  prescription: {
    sessionType: SessionType
    targetDistanceKm: number | null
    targetDurationMin: number | null
    weekNo: number
    phase: PlanPhase
    isRecoveryWeek: boolean
    /** SPEC.md §6.3: LONG_RUN day → 5 g/kg carbs. */
    isLongRun: boolean
    /** SPEC.md §6.3: QUALITY_RUN day (tempo/interval) → 4 g/kg carbs. */
    isQualityRun: boolean
  }
}

export interface GeneratedBlock {
  name: string
  phase: BlockPhase
  /** UTC instant representing the local calendar day (see localDateToUtcMidnight). */
  startDate: Date
  endDate: Date
  sessions: GeneratedSession[]
}

export interface GeneratePlanInput {
  goalType: GoalType
  /** Ignored for c25k, which is always duration-based and starts at week 1. */
  currentWeeklyKm: number
  /** Local calendar date (YYYY-MM-DD) the plan should start from; anchored to the following Monday. */
  startDate: string
  /** Local calendar date (YYYY-MM-DD), optional — triggers the feasibility gate. */
  goalDate?: string | null
  /** IANA timezone (Profile.timezone) used to compute session UTC instants. */
  timezone: string
}

export interface GeneratePlanResult {
  goalType: GoalType
  entryWeekNo: number
  blocks: GeneratedBlock[]
  feasibility: FeasibilityResult | null
}

/**
 * Generates a full set of TrainingBlocks + ScheduledItems (RUN type) from a
 * static template, entering at the week matching the runner's current
 * fitness. Pure — takes plain inputs, returns plain data, no DB access; the
 * `generateTrainingPlan` service persists the result.
 */
export function generatePlan(input: GeneratePlanInput): GeneratePlanResult {
  const { goalType, currentWeeklyKm, startDate, goalDate, timezone } = input

  const allWeeks = PLAN_TEMPLATES[goalType]
  if (!allWeeks) {
    throw new Error(
      `generatePlan: unknown goalType ${JSON.stringify(goalType)}`
    )
  }

  // C25K is duration-based — always start at week 1 (donor behaviour).
  const entryWeek =
    goalType === 'c25k' ? allWeeks[0] : findEntryWeek(allWeeks, currentWeeklyKm)

  const feasibility = goalDate
    ? checkFeasibility(goalType, entryWeek.weekNo, startDate, goalDate)
    : null

  const weeksFromEntry = allWeeks.filter(
    (week) => week.weekNo >= entryWeek.weekNo
  )
  const segments = segmentByPhase(weeksFromEntry)
  const planStartMonday = firstMondayOnOrAfter(startDate)
  const goalLabel = GOAL_LABELS[goalType]

  const blocks: GeneratedBlock[] = []
  let weekOffset = 0 // 0-based index into weeksFromEntry, drives the Monday anchor

  for (const segment of segments) {
    const segmentStartOffset = weekOffset
    const sessions: GeneratedSession[] = []

    for (const week of segment) {
      const weekNoForDisplay = weekOffset + 1 // 1-based, matches donor's plan_week_offset
      const weekMonday = addLocalDays(planStartMonday, weekOffset * 7)

      for (const session of week.sessions) {
        const sessionDateStr = addLocalDays(weekMonday, session.day - 1)
        const { startUtc } = localDayBoundsUtc(sessionDateStr, timezone)

        sessions.push({
          type: 'RUN',
          title: `W${weekNoForDisplay} ${DAY_ABBR[session.day]} — ${SESSION_TYPE_LABEL[session.sessionType]}`,
          description: session.description,
          scheduledAt: new Date(
            startUtc.getTime() + DEFAULT_SESSION_START_OFFSET_MS
          ),
          durationMin: session.targetDurationMin,
          prescription: {
            sessionType: session.sessionType,
            targetDistanceKm: session.targetDistanceKm,
            targetDurationMin: session.targetDurationMin,
            weekNo: weekNoForDisplay,
            phase: week.phase,
            isRecoveryWeek: week.isRecovery,
            isLongRun: session.sessionType === 'long',
            isQualityRun:
              session.sessionType === 'tempo' ||
              session.sessionType === 'interval',
          },
        })
      }

      weekOffset += 1
    }

    blocks.push({
      name: `${goalLabel} — ${PHASE_LABEL[segment[0].phase]}`,
      phase: PHASE_TO_BLOCK_PHASE[segment[0].phase],
      startDate: localDateToUtcMidnight(
        addLocalDays(planStartMonday, segmentStartOffset * 7)
      ),
      endDate: localDateToUtcMidnight(
        addLocalDays(planStartMonday, weekOffset * 7 - 1)
      ),
      sessions,
    })
  }

  return { goalType, entryWeekNo: entryWeek.weekNo, blocks, feasibility }
}
