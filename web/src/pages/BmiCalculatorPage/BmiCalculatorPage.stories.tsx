import type { Meta, StoryObj } from '@storybook/react'

import BmiCalculatorPage from './BmiCalculatorPage'

const meta: Meta<typeof BmiCalculatorPage> = {
  component: BmiCalculatorPage,
}

export default meta

type Story = StoryObj<typeof BmiCalculatorPage>

export const Primary: Story = {}
