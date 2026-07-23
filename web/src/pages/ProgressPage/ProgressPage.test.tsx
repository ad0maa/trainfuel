import { render } from '@cedarjs/testing/web'

import ProgressPage from './ProgressPage'

//   Improve this test with help from the CedarJS Testing Doc:
//   https://cedarjs.com/docs/testing#testing-pages-layouts

describe('ProgressPage', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<ProgressPage />)
    }).not.toThrow()
  })
})
