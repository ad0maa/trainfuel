// Define your own mock data here:
export const standard = (/* vars, { ctx, req } */) => ({
  todayScheduledItems: [
    {
      __typename: 'ScheduledItem' as const,
      id: 'item-1',
      type: 'RUN' as const,
      title: 'Easy 8km',
      description: 'Zone 2, flat route',
      scheduledAt: '2026-07-15T20:00:00.000Z',
      durationMin: 45,
      status: 'PLANNED' as const,
      completion: null,
    },
    {
      __typename: 'ScheduledItem' as const,
      id: 'item-2',
      type: 'SUPPLEMENT' as const,
      title: 'Creatine 5g',
      description: null,
      scheduledAt: '2026-07-15T22:00:00.000Z',
      durationMin: null,
      status: 'COMPLETED' as const,
      completion: {
        __typename: 'Completion' as const,
        id: 'completion-1',
        source: 'MANUAL' as const,
        matchConfidence: 'MANUAL' as const,
        completedAt: '2026-07-15T22:05:00.000Z',
      },
    },
  ],
})
