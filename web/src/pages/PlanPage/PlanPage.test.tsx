import { render } from '@cedarjs/testing/web'

import PlanPage from './PlanPage'

//   Improve this test with help from the CedarJS Testing Doc:
//   https://cedarjs.com/docs/testing#testing-pages-layouts

describe('PlanPage', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<PlanPage />)
    }).not.toThrow()
  })
})
