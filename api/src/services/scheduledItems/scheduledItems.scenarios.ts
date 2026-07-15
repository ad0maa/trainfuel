import type { Profile, ScheduledItem, TrainingBlock, User } from 'src/lib/db'

// Explicit <{ data: any }, string, string> generics: defineScenario's
// default inference unifies TKeys (fixture names) across *all* models in a
// single call, so with the default inference every model would need every
// other model's fixture names too (e.g. `scheduledItem` would need a
// `owner`/`other` key just because `user` has one). Widening ModelName/TKeys
// to `string` sidesteps that false requirement while still typing each
// fixture's `data`/function shape.
export const standard = defineScenario<{ data: any }, string, string>({
  user: {
    owner: {
      data: {
        email: 'owner1@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
    other: {
      data: {
        email: 'owner2@example.com',
        hashedPassword: 'String',
        salt: 'String',
      },
    },
  },
  profile: {
    owner: (scenario: any) => ({
      data: {
        userId: scenario.user.owner.id,
        sex: 'MALE',
        birthDate: '1992-01-01T00:00:00.000Z',
        heightCm: 180,
        timezone: 'Australia/Melbourne',
      },
    }),
  },
  trainingBlock: {
    ownerBlock: (scenario: any) => ({
      data: {
        name: 'Build block',
        phase: 'BUILD',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-01T00:00:00.000Z',
        userId: scenario.user.owner.id,
      },
    }),
  },
  scheduledItem: {
    // All non-"today" fixtures below are anchored to the real current
    // instant (± a wide enough margin to clear any timezone's local-day
    // boundary) rather than a fixed calendar date. A fixed date is
    // guaranteed to eventually collide with "today" as the wall clock
    // advances past it — which is exactly what happened here: a
    // 2026-07-15T20:00:00Z fixture, intended as "not today", silently
    // became "today" in Australia/Melbourne (UTC+10/+11) once the suite
    // ran on 2026-07-16. See DECISIONS.md.
    planned: (scenario: any) => ({
      data: {
        type: 'RUN',
        title: 'Easy 8km',
        scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: 'PLANNED',
        userId: scenario.user.owner.id,
        blockId: scenario.trainingBlock.ownerBlock.id,
      },
    }),
    othersItem: (scenario: any) => ({
      data: {
        type: 'LIFT',
        title: 'Leg day',
        scheduledAt: new Date(),
        status: 'PLANNED',
        userId: scenario.user.other.id,
      },
    }),
    completed: (scenario: any) => ({
      data: {
        type: 'RUN',
        title: 'Long run',
        scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        status: 'COMPLETED',
        userId: scenario.user.owner.id,
        completion: {
          create: {
            userId: scenario.user.owner.id,
            completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            source: 'STRAVA',
            matchConfidence: 'EXACT',
          },
        },
      },
    }),
    templateItem: (scenario: any) => ({
      data: {
        type: 'SUPPLEMENT',
        title: 'Creatine 5g',
        scheduledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        status: 'PLANNED',
        isTemplate: true,
        recurrenceRule: 'FREQ=DAILY',
        userId: scenario.user.owner.id,
      },
    }),
    // Anchored to "now" (seed time) rather than a fixed 2026 date, so
    // todayScheduledItems() — which uses the real current instant — reliably
    // finds it regardless of what day the test suite actually runs on.
    todayItem: (scenario: any) => ({
      data: {
        type: 'MEDICATION',
        title: "Today's dose",
        scheduledAt: new Date(),
        status: 'PLANNED',
        userId: scenario.user.owner.id,
      },
    }),
  },
})

export type StandardScenario = {
  user: Record<'owner' | 'other', User>
  profile: Record<'owner', Profile>
  trainingBlock: Record<'ownerBlock', TrainingBlock>
  scheduledItem: Record<
    'planned' | 'othersItem' | 'completed' | 'templateItem' | 'todayItem',
    ScheduledItem
  >
}
