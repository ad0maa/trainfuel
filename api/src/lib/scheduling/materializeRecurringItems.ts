// SPEC.md §3.2 / §8 (M1): "Recurring meds use recurrenceRule and are
// materialized into concrete daily rows by a nightly job for the next 14
// days (keeps queries and ticking dead simple; avoid on-the-fly recurrence
// math in the read path)."
//
// This module is the pure, unit-testable core of that job: given "now", a
// window size, a set of recurring "template" ScheduledItems, and the set of
// instances already materialized from them, it returns exactly the new
// instance rows that need to be created. It has no DB access and performs
// no side effects — the runnable script
// (api/src/scripts/materializeRecurringItems.ts) is a thin wrapper that
// fetches templates/existing instances from Prisma, calls this function,
// and creates the returned rows.
//
// Template/instance design (see DECISIONS.md for the full rationale): a
// "template" is a ScheduledItem row with `isTemplate: true` and
// `recurrenceRule` set. Its own `scheduledAt` is the RRULE anchor (DTSTART +
// time-of-day) — it is never itself shown on the Today screen or completable.
// A "instance" is a normal ScheduledItem row (`isTemplate: false`,
// `recurrenceRule: null`) with `templateId` pointing back at its template.
//
// Idempotency: re-running for an overlapping window must not create
// duplicates. We key on (templateId, scheduledAt) — the same pair the DB's
// `@@unique([templateId, scheduledAt])` constraint enforces as a backstop.

import { RRule } from 'rrule'

export type MaterializableType =
  | 'MEDICATION'
  | 'SUPPLEMENT'
  | 'RUN'
  | 'LIFT'
  | 'OTHER'

/** A recurring "template" ScheduledItem, as read from the DB. */
export interface RecurringTemplate {
  id: string
  userId: string
  blockId: string | null
  type: MaterializableType
  title: string
  description: string | null
  durationMin: number | null
  prescription: unknown
  pushToCalendar: boolean
  /** RFC5545 RRULE string, e.g. "FREQ=DAILY;INTERVAL=1". No DTSTART line — the anchor below supplies it. */
  recurrenceRule: string
  /** The template's own `scheduledAt` — supplies both DTSTART and the local time-of-day for every occurrence. */
  anchorAt: Date
}

/** The (templateId, scheduledAt) identity of an already-materialized instance, used for dedup. */
export interface ExistingInstanceKey {
  templateId: string
  scheduledAt: Date
}

/** A concrete row to create for a template occurrence. */
export interface MaterializedInstance {
  templateId: string
  userId: string
  blockId: string | null
  type: MaterializableType
  title: string
  description: string | null
  durationMin: number | null
  prescription: unknown
  pushToCalendar: boolean
  scheduledAt: Date
}

export interface MaterializeRecurringItemsInput {
  /** The instant the job is "running" as of — the expansion window starts here. */
  now: Date
  /** How many days forward to materialize. SPEC.md §3.2 default: 14. */
  windowDays?: number
  templates: RecurringTemplate[]
  existingInstances: ExistingInstanceKey[]
}

const DEFAULT_WINDOW_DAYS = 14

function existingKey(templateId: string, scheduledAt: Date): string {
  return `${templateId}|${scheduledAt.toISOString()}`
}

/**
 * Expands each recurring template's RRULE across [now, now + windowDays] and
 * returns only the occurrences that don't already have a materialized
 * instance. Pure function — no DB access, safe to call repeatedly with
 * overlapping windows (idempotent).
 */
export function materializeRecurringItems({
  now,
  windowDays = DEFAULT_WINDOW_DAYS,
  templates,
  existingInstances,
}: MaterializeRecurringItemsInput): MaterializedInstance[] {
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)

  const existingKeys = new Set(
    existingInstances.map((i) => existingKey(i.templateId, i.scheduledAt))
  )

  const result: MaterializedInstance[] = []

  for (const template of templates) {
    let occurrences: Date[]
    try {
      const parsed = RRule.parseString(template.recurrenceRule)
      const rule = new RRule({ ...parsed, dtstart: template.anchorAt })
      // `between` is inclusive at both ends when the 3rd arg is true.
      occurrences = rule.between(now, windowEnd, true)
    } catch {
      // Malformed recurrenceRule on a template shouldn't blow up the whole
      // job run for every other template — skip it. (Validation on write
      // is the service layer's job; this is a defensive fallback.)
      continue
    }

    for (const occurrenceAt of occurrences) {
      const key = existingKey(template.id, occurrenceAt)
      if (existingKeys.has(key)) {
        continue
      }
      // Guard against duplicate occurrences within the same call (e.g. a
      // pathological RRULE) too, not just against pre-existing DB rows.
      existingKeys.add(key)

      result.push({
        templateId: template.id,
        userId: template.userId,
        blockId: template.blockId,
        type: template.type,
        title: template.title,
        description: template.description,
        durationMin: template.durationMin,
        prescription: template.prescription,
        pushToCalendar: template.pushToCalendar,
        scheduledAt: occurrenceAt,
      })
    }
  }

  return result
}
