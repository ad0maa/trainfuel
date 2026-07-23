import { useEffect, useState } from 'react'

import type {
  ActivityBaseline,
  Sex,
  TdeeCalculatorProfileQuery,
  TdeeEstimateQuery,
  TdeeEstimateQueryVariables,
} from 'types/graphql'

import { Metadata, useQuery } from '@cedarjs/web'
import type { TypedDocumentNode } from '@cedarjs/web'

import PageHeader from 'src/components/PageHeader/PageHeader'

const PROFILE_QUERY: TypedDocumentNode<TdeeCalculatorProfileQuery> = gql`
  query TdeeCalculatorProfileQuery {
    myProfile {
      sex
      birthDate
      heightCm
      currentWeightKg
      activityBaseline
    }
  }
`

const TDEE_ESTIMATE_QUERY: TypedDocumentNode<
  TdeeEstimateQuery,
  TdeeEstimateQueryVariables
> = gql`
  query TdeeEstimateQuery($input: TdeeEstimateInput!) {
    tdeeEstimate(input: $input) {
      bmr
      tdee
    }
  }
`

const ACTIVITY_LABELS: Record<ActivityBaseline, string> = {
  SEDENTARY: 'Sedentary (little/no exercise)',
  LIGHT: 'Light (1-3 days/week)',
  MODERATE: 'Moderate (3-5 days/week)',
  ACTIVE: 'Active (6-7 days/week)',
  VERY_ACTIVE: 'Very active (physical job or 2x/day)',
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const TdeeCalculatorPage = () => {
  const { data: profileData } = useQuery(PROFILE_QUERY)

  const [sex, setSex] = useState<Sex>('MALE')
  const [birthDate, setBirthDate] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [activityBaseline, setActivityBaseline] =
    useState<ActivityBaseline>('SEDENTARY')
  const [prefilled, setPrefilled] = useState(false)

  useEffect(() => {
    if (prefilled || !profileData?.myProfile) return
    const p = profileData.myProfile
    setSex(p.sex)
    setBirthDate(toDateInputValue(new Date(p.birthDate)))
    setHeightCm(String(p.heightCm))
    if (p.currentWeightKg != null) setWeightKg(String(p.currentWeightKg))
    setActivityBaseline(p.activityBaseline)
    setPrefilled(true)
  }, [profileData, prefilled])

  const heightNum = Number(heightCm)
  const weightNum = Number(weightKg)
  const canCalculate =
    !!birthDate &&
    Number.isFinite(heightNum) &&
    heightNum > 0 &&
    Number.isFinite(weightNum) &&
    weightNum > 0

  const { data: estimateData } = useQuery(TDEE_ESTIMATE_QUERY, {
    skip: !canCalculate,
    variables: {
      input: {
        sex,
        birthDate: canCalculate ? `${birthDate}T00:00:00.000Z` : '',
        heightCm: heightNum,
        weightKg: weightNum,
        activityBaseline,
      },
    },
  })

  return (
    <>
      <Metadata
        title="TDEE calculator"
        description="Total daily energy expenditure calculator"
      />
      <PageHeader
        title="TDEE calculator"
        subtitle="Total daily energy expenditure"
      />

      <section className="tf-plan-section">
        <form
          className="tf-calculator-form"
          onSubmit={(e) => e.preventDefault()}
        >
          <label className="tf-field">
            <span>Sex</span>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </label>
          <label className="tf-field">
            <span>Birth date</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>
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
          <label className="tf-field">
            <span>Activity level</span>
            <select
              value={activityBaseline}
              onChange={(e) =>
                setActivityBaseline(e.target.value as ActivityBaseline)
              }
            >
              {Object.entries(ACTIVITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </form>

        {estimateData?.tdeeEstimate ? (
          <div className="tf-calculator-result">
            <div>
              <div className="tf-calculator-result-value">
                {Math.round(estimateData.tdeeEstimate.tdee)}
              </div>
              <span className="tf-empty">kcal/day (TDEE)</span>
            </div>
            <div>
              <div className="tf-calculator-result-value">
                {Math.round(estimateData.tdeeEstimate.bmr)}
              </div>
              <span className="tf-empty">kcal/day (BMR)</span>
            </div>
          </div>
        ) : (
          <p className="tf-empty">
            Fill in the fields above to estimate your daily energy needs.
          </p>
        )}
      </section>
    </>
  )
}

export default TdeeCalculatorPage
