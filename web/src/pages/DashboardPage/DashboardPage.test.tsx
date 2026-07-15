import { render } from '@cedarjs/testing/web'

import DashboardPage from './DashboardPage'

//   Improve this test with help from the CedarJS Testing Doc:
//   https://cedarjs.com/docs/testing#testing-pages-layouts

describe('DashboardPage', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<DashboardPage />)
    }).not.toThrow()
  })
})
