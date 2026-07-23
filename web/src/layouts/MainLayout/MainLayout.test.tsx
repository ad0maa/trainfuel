import { render } from '@cedarjs/testing/web'

import MainLayout from './MainLayout'

//   Improve this test with help from the CedarJS Testing Doc:
//   https://cedarjs.com/docs/testing#testing-pages-layouts

describe('MainLayout', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<MainLayout />)
    }).not.toThrow()
  })
})
