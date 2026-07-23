import type { Meta, StoryObj } from '@storybook/react'

import ProgressPage from './ProgressPage'

const meta: Meta<typeof ProgressPage> = {
  component: ProgressPage,
}

export default meta

type Story = StoryObj<typeof ProgressPage>

export const Primary: Story = {}
