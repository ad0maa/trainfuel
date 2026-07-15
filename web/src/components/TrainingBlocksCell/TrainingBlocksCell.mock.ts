// Define your own mock data here:
export const standard = (/* vars, { ctx, req } */) => ({
  trainingBlocks: [
    {
      __typename: 'TrainingBlock' as const,
      id: 'block-1',
      name: 'Geelong HM — Build',
      phase: 'BUILD' as const,
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-08-26T00:00:00.000Z',
      notes: null,
      sessions: [{ __typename: 'ScheduledItem' as const, id: 'item-1' }],
    },
  ],
})
