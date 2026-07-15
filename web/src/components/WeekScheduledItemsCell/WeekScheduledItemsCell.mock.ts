// Define your own mock data here:
export const standard = (/* vars, { ctx, req } */) => ({
  scheduledItems: [
    {
      __typename: 'ScheduledItem' as const,
      id: 'item-1',
      type: 'RUN' as const,
      title: 'Easy 8km',
      scheduledAt: '2026-07-15T20:00:00.000Z',
      status: 'PLANNED' as const,
      block: {
        __typename: 'TrainingBlock' as const,
        id: 'block-1',
        name: 'Build block',
      },
    },
  ],
})
