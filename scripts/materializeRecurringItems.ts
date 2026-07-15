// Nightly materialization job for recurring MEDICATION/SUPPLEMENT
// ScheduledItem templates (SPEC.md §3.2, §8 M1).
//
// Fetches every `isTemplate: true` ScheduledItem for every user, expands
// each one's RRULE across the next 14 days via the pure
// `materializeRecurringItems` function (api/src/lib/scheduling), and
// creates the concrete instance rows that don't already exist. Safe to
// re-run at any time — idempotent by (templateId, scheduledAt), backed by
// the DB's own `@@unique([templateId, scheduledAt])` constraint as well.
//
// Cron wiring: not built in M1 — see DECISIONS.md. Run manually or from an
// external scheduler with:
//
//   yarn cedar exec materializeRecurringItems

import type { Prisma } from 'api/src/lib/db'
import { db } from 'api/src/lib/db'
import {
  materializeRecurringItems,
  type RecurringTemplate,
} from 'api/src/lib/scheduling/materializeRecurringItems'

interface ScriptArgs {
  _: string[]
  windowDays?: number
  [key: string]: unknown
}

// Cedar's `exec` runner calls the default export as `fn({ args: scriptArgs })`
// — the parsed CLI flags live one level down, under `args`, not on the
// outer parameter itself.
export default async ({ args }: { args: ScriptArgs }) => {
  const windowDays = Number(args.windowDays) || 14
  const now = new Date()

  const templateRows = await db.scheduledItem.findMany({
    where: { isTemplate: true, recurrenceRule: { not: null } },
  })

  if (templateRows.length === 0) {
    console.log(
      'materializeRecurringItems: no recurring templates found, nothing to do.'
    )
    return
  }

  const templates: RecurringTemplate[] = templateRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    blockId: row.blockId,
    // ScheduledItemType is a superset of MaterializableType at the DB
    // level; template rows are meds/supps in practice but the expansion
    // logic doesn't care about the specific type.
    type: row.type as RecurringTemplate['type'],
    title: row.title,
    description: row.description,
    durationMin: row.durationMin,
    prescription: row.prescription,
    pushToCalendar: row.pushToCalendar,
    // Non-null assertion is safe: the query above filters recurrenceRule: { not: null }.
    recurrenceRule: row.recurrenceRule as string,
    anchorAt: row.scheduledAt,
  }))

  const existingInstances = await db.scheduledItem.findMany({
    where: { templateId: { in: templates.map((t) => t.id) } },
    select: { templateId: true, scheduledAt: true },
  })

  const toCreate = materializeRecurringItems({
    now,
    windowDays,
    templates,
    existingInstances: existingInstances.map((i) => ({
      templateId: i.templateId as string,
      scheduledAt: i.scheduledAt,
    })),
  })

  if (toCreate.length === 0) {
    console.log('materializeRecurringItems: nothing new to materialize.')
    return
  }

  const result = await db.scheduledItem.createMany({
    data: toCreate.map((instance) => ({
      userId: instance.userId,
      blockId: instance.blockId,
      templateId: instance.templateId,
      type: instance.type,
      title: instance.title,
      description: instance.description,
      durationMin: instance.durationMin,
      prescription: (instance.prescription ?? undefined) as
        | Prisma.InputJsonValue
        | undefined,
      pushToCalendar: instance.pushToCalendar,
      scheduledAt: instance.scheduledAt,
      isTemplate: false,
    })),
    // Defense in depth: the pure function already dedupes against
    // `existingInstances`, but a concurrent run (or a second job overlap)
    // could race — the DB's unique constraint is the real backstop.
    skipDuplicates: true,
  })

  console.log(
    `materializeRecurringItems: created ${result.count} instance(s) from ${templates.length} template(s).`
  )
}
