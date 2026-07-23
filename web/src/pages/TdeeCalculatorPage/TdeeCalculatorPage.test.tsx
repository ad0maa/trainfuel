import { render } from '@cedarjs/testing/web'

import TdeeCalculatorPage from './TdeeCalculatorPage'

//   Improve this test with help from the CedarJS Testing Doc:
//   https://cedarjs.com/docs/testing#testing-pages-layouts

describe('TdeeCalculatorPage', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<TdeeCalculatorPage />)
    }).not.toThrow()
  })
})
