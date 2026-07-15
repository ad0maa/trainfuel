import type { ScenarioData } from '@cedarjs/testing/api'

import type { Prisma, TrainingBlock } from 'src/lib/db'

export const standard = defineScenario<Prisma.TrainingBlockCreateArgs>({
  trainingBlock: {
    one: {
      data: {
        name: 'Geelong HM — Build',
        phase: 'BUILD',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-08-26T00:00:00.000Z',
        user: {
          create: {
            email: 'owner1@example.com',
            hashedPassword: 'String',
            salt: 'String',
          },
        },
      },
    },
    two: {
      data: {
        name: 'Rebuild block',
        phase: 'REBUILD',
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
        user: {
          create: {
            email: 'owner2@example.com',
            hashedPassword: 'String',
            salt: 'String',
          },
        },
      },
    },
  },
})

export type StandardScenario = ScenarioData<TrainingBlock, 'trainingBlock'>
