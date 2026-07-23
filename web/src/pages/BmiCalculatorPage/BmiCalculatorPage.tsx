import { useEffect, useState } from 'react'

import type { BmiCalculatorProfileQuery } from 'types/graphql'

import { Metadata, useQuery } from '@cedarjs/web'
import type { TypedDocumentNode } from '@cedarjs/web'

import PageHeader from 'src/components/PageHeader/PageHeader'

const PROFILE_QUERY: TypedDocumentNode<BmiCalculatorProfileQuery> = gql`
  query BmiCalculatorProfileQuery {
    myProfile {
      heightCm
      currentWeightKg
    }
  }
`

interface BmiCategory {
  label: string
  className: string
}

// Standard WHO adult BMI bands.
function categorizeBmi(bmi: number): BmiCategory {
  if (bmi < 18.5) return { label: 'Underweight', className: 'tf-badge-warn' }
  if (bmi < 25) return { label: 'Healthy weight', className: 'tf-badge-ok' }
  if (bmi < 30) return { label: 'Overweight', className: 'tf-badge-warn' }
  return { label: 'Obese', className: 'tf-badge-danger' }
}

const BmiCalculatorPage = () => {
  const { data } = useQuery(PROFILE_QUERY)
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (prefilled || !data?.myProfile) return
    const { heightCm: h, currentWeightKg: w } = data.myProfile
    if (h != null) setHeightCm(String(h))
    if (w != null) setWeightKg(String(w))
    setPrefilled(true)
  }, [data, prefilled])

  const heightM = Number(heightCm) / 100
  const weight = Number(weightKg)
  const canCalculate =
    Number.isFinite(heightM) &&
    heightM > 0 &&
    Number.isFinite(weight) &&
    weight > 0
  const bmi = canCalculate ? weight / (heightM * heightM) : null
  const category = bmi != null ? categorizeBmi(bmi) : null

  return (
    <>
      <Metadata
        title="BMI calculator"
        description="Body mass index calculator"
      />
      <PageHeader title="BMI calculator" subtitle="Body mass index" />

      <section className="tf-plan-section">
        <form
          className="tf-calculator-form"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="tf-field">
            <span>Height (cm)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </label>
          <label className="tf-field">
            <span>Weight (kg)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </label>
        </form>

        {bmi != null && category ? (
          <div className="tf-calculator-result">
            <div className="tf-calculator-result-value">{bmi.toFixed(1)}</div>
            <span className={`tf-badge ${category.className}`}>
              {category.label}
            </span>
          </div>
        ) : (
          <p className="tf-empty">Enter your height and weight to calculate.</p>
        )}
      </section>
    </>
  )
}

export default BmiCalculatorPage
