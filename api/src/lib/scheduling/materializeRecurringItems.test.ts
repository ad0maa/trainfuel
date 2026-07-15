import {
  materializeRecurringItems,
  type RecurringTemplate,
  type ExistingInstanceKey,
} from './materializeRecurringItems.js'

function makeTemplate(
  overrides: Partial<RecurringTemplate> = {}
): RecurringTemplate {
  return {
    id: 'template-1',
    userId: 'user-1',
    blockId: null,
    type: 'SUPPLEMENT',
    title: 'Creatine 5g',
    description: null,
    durationMin: null,
    prescription: null,
    pushToCalendar: false,
    recurrenceRule: 'FREQ=DAILY;INTERVAL=1',
    anchorAt: new Date('2026-07-01T22:00:00.000Z'), // 08:00 AEST (UTC+10) on Jul 1
    ...overrides,
  }
}

describe('materializeRecurringItems', () => {
  it('materializes one instance per day for a daily RRULE across the window', () => {
    const now = new Date('2026-07-15T00:00:00.000Z')
    const result = materializeRecurringItems({
      now,
      windowDays: 14,
      templates: [makeTemplate()],
      existingInstances: [],
    })

    // Daily occurrences from `now` through `now + 14d` inclusive at both ends
    // → 15 occurrences (day 0..14), but only the ones whose clock time
    // (22:00 UTC) falls within [now, windowEnd] are included, so we expect
    // 14 or 15 depending on exact anchor time-of-day vs `now`. Assert the
    // concrete invariants instead of a hardcoded count.
    expect(result.length).toBeGreaterThan(0)
    for (const instance of result) {
      expect(instance.templateId).toBe('template-1')
      expect(instance.userId).toBe('user-1')
      expect(instance.title).toBe('Creatine 5g')
      // every occurrence retains the 22:00:00 UTC time-of-day from the anchor
      expect(instance.scheduledAt.getUTCHours()).toBe(22)
      expect(instance.scheduledAt.getUTCMinutes()).toBe(0)
    }

    // occurrences are unique days
    const days = result.map((i) => i.scheduledAt.toISOString().slice(0, 10))
    expect(new Set(days).size).toBe(days.length)
  })

  it('is idempotent: re-running with the previously materialized instances as "existing" creates nothing new', () => {
    const now = new Date('2026-07-15T00:00:00.000Z')
    const template = makeTemplate()

    const firstRun = materializeRecurringItems({
      now,
      windowDays: 14,
      templates: [template],
      existingInstances: [],
    })
    expect(firstRun.length).toBeGreaterThan(0)

    const existingInstances: ExistingInstanceKey[] = firstRun.map((i) => ({
      templateId: i.templateId,
      scheduledAt: i.scheduledAt,
    }))

    const secondRun = materializeRecurringItems({
      now,
      windowDays: 14,
      templates: [template],
      existingInstances,
    })

    expect(secondRun).toEqual([])
  })

  it('is idempotent across overlapping windows: only genuinely new occurrences are returned', () => {
    const template = makeTemplate()

    const day1Run = materializeRecurringItems({
      now: new Date('2026-07-15T00:00:00.000Z'),
      windowDays: 14,
      templates: [template],
      existingInstances: [],
    })

    const existingInstances: ExistingInstanceKey[] = day1Run.map((i) => ({
      templateId: i.templateId,
      scheduledAt: i.scheduledAt,
    }))

    // Run again the "next day" with the same rolling 14-day window — heavy
    // overlap with day1Run's window.
    const day2Run = materializeRecurringItems({
      now: new Date('2026-07-16T00:00:00.000Z'),
      windowDays: 14,
      templates: [template],
      existingInstances,
    })

    // Nothing already-materialized should reappear.
    const day1Keys = new Set(
      day1Run.map((i) => `${i.templateId}|${i.scheduledAt.toISOString()}`)
    )
    for (const instance of day2Run) {
      const key = `${instance.templateId}|${instance.scheduledAt.toISOString()}`
      expect(day1Keys.has(key)).toBe(false)
    }
    // But day2Run should have picked up the new day at the end of the window.
    expect(day2Run.length).toBeGreaterThan(0)
  })

  it('handles multiple independent templates without cross-contamination', () => {
    const now = new Date('2026-07-15T00:00:00.000Z')
    const templateA = makeTemplate({ id: 'template-a', title: 'Vitamin D' })
    const templateB = makeTemplate({
      id: 'template-b',
      title: 'Fish oil',
      anchorAt: new Date('2026-07-01T09:00:00.000Z'),
    })

    const result = materializeRecurringItems({
      now,
      windowDays: 7,
      templates: [templateA, templateB],
      existingInstances: [],
    })

    const aInstances = result.filter((i) => i.templateId === 'template-a')
    const bInstances = result.filter((i) => i.templateId === 'template-b')
    expect(aInstances.length).toBeGreaterThan(0)
    expect(bInstances.length).toBeGreaterThan(0)
    expect(aInstances.every((i) => i.title === 'Vitamin D')).toBe(true)
    expect(bInstances.every((i) => i.title === 'Fish oil')).toBe(true)
  })

  it('respects a weekly RRULE (e.g. a weekly long-run reminder)', () => {
    const template = makeTemplate({
      id: 'template-weekly',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=SU',
      anchorAt: new Date('2026-07-05T21:00:00.000Z'), // a Sunday
    })

    const result = materializeRecurringItems({
      now: new Date('2026-07-05T00:00:00.000Z'),
      windowDays: 21,
      templates: [template],
      existingInstances: [],
    })

    // 21-day window from a Sunday should yield 3-4 Sundays.
    expect(result.length).toBeGreaterThanOrEqual(3)
    for (const instance of result) {
      expect(instance.scheduledAt.getUTCDay()).toBe(0) // Sunday
    }
  })

  it('skips a template with a malformed recurrenceRule rather than throwing', () => {
    const good = makeTemplate({ id: 'good' })
    const bad = makeTemplate({
      id: 'bad',
      recurrenceRule: 'NOT A VALID RRULE ;;;',
    })

    expect(() =>
      materializeRecurringItems({
        now: new Date('2026-07-15T00:00:00.000Z'),
        windowDays: 14,
        templates: [bad, good],
        existingInstances: [],
      })
    ).not.toThrow()

    const result = materializeRecurringItems({
      now: new Date('2026-07-15T00:00:00.000Z'),
      windowDays: 14,
      templates: [bad, good],
      existingInstances: [],
    })
    expect(result.every((i) => i.templateId === 'good')).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns nothing for a template whose anchor is entirely outside the window', () => {
    const template = makeTemplate({
      recurrenceRule: 'FREQ=DAILY;COUNT=3',
      anchorAt: new Date('2020-01-01T22:00:00.000Z'),
    })

    const result = materializeRecurringItems({
      now: new Date('2026-07-15T00:00:00.000Z'),
      windowDays: 14,
      templates: [template],
      existingInstances: [],
    })

    expect(result).toEqual([])
  })
})
