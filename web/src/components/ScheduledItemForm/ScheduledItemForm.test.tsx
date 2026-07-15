import { render } from '@cedarjs/testing/web'

import ScheduledItemForm from './ScheduledItemForm'

//   Improve this test with help from the CedarJS Testing Doc:
//    https://cedarjs.com/docs/testing#testing-components

describe('ScheduledItemForm', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<ScheduledItemForm />)
    }).not.toThrow()
  })
})
