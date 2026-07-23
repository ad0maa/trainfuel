import { render } from '@cedarjs/testing/web'

import BmiCalculatorPage from './BmiCalculatorPage'

//   Improve this test with help from the CedarJS Testing Doc:
//   https://cedarjs.com/docs/testing#testing-pages-layouts

describe('BmiCalculatorPage', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<BmiCalculatorPage />)
    }).not.toThrow()
  })
})
