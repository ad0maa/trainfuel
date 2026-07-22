import { render } from '@cedarjs/testing/web'

import { Loading, Empty, Failure, Success } from './DailyEnergySummaryCell'
import { standard } from './DailyEnergySummaryCell.mock'

describe('DailyEnergySummaryCell', () => {
  it('renders Loading successfully', () => {
    expect(() => {
      render(<Loading />)
    }).not.toThrow()
  })

  it('renders Empty successfully', async () => {
    expect(() => {
      render(<Empty />)
    }).not.toThrow()
  })

  it('renders Failure successfully', async () => {
    expect(() => {
      render(<Failure error={new Error('Oh no')} />)
    }).not.toThrow()
  })

  it('renders Success successfully', async () => {
    expect(() => {
      render(<Success {...standard()} />)
    }).not.toThrow()
  })

  it('shows the flooredAtBmr note when true', async () => {
    const { getByText } = render(
      <Success
        todayEnergySummary={{
          ...standard().todayEnergySummary,
          flooredAtBmr: true,
        }}
      />
    )
    expect(getByText(/capped at your BMR/)).toBeInTheDocument()
  })
})
