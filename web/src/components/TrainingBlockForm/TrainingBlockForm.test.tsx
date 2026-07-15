import { render } from '@cedarjs/testing/web'

import TrainingBlockForm from './TrainingBlockForm'

//   Improve this test with help from the CedarJS Testing Doc:
//    https://cedarjs.com/docs/testing#testing-components

describe('TrainingBlockForm', () => {
  it('renders successfully', () => {
    expect(() => {
      render(<TrainingBlockForm />)
    }).not.toThrow()
  })
})
