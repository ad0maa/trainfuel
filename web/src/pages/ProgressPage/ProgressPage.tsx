import { useMemo, useState } from 'react'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  ProgressDailyMetricsQuery,
  ProgressDailyMetricsQueryVariables,
  ProgressLiftActivitiesQuery,
  ProgressLiftActivitiesQueryVariables,
} from 'types/graphql'

import { Metadata, useQuery } from '@cedarjs/web'
import type { TypedDocumentNode } from '@cedarjs/web'

import PageHeader from 'src/components/PageHeader/PageHeader'

const DAILY_METRICS_QUERY: TypedDocumentNode<
  ProgressDailyMetricsQuery,
  ProgressDailyMetricsQueryVariables
> = gql`
  query ProgressDailyMetricsQuery($days: Int!) {
    dailyMetrics(days: $days) {
      date
      weightKg
    }
  }
`

const LIFT_ACTIVITIES_QUERY: TypedDocumentNode<
  ProgressLiftActivitiesQuery,
  ProgressLiftActivitiesQueryVariables
> = gql`
  query ProgressLiftActivitiesQuery($days: Int!) {
    liftActivities(days: $days) {
      id
      startedAt
      exercises {
        name
        sets
      }
    }
  }
`

const DAYS = 180
// SPEC.md §7.1: "simple EMA fine in v1." Smoothing factor for a ~2-week
// half-life on daily weight samples.
const EMA_ALPHA = 0.15

interface WeightPoint {
  date: string
  weightKg: number
  trend: number
}

function buildWeightSeries(
  rows: ProgressDailyMetricsQuery['dailyMetrics']
): WeightPoint[] {
  const withWeight = rows.filter(
    (r): r is typeof r & { weightKg: number } => r.weightKg != null
  )
  let ema: number | null = null
  return withWeight.map((r) => {
    ema =
      ema == null ? r.weightKg : EMA_ALPHA * r.weightKg + (1 - EMA_ALPHA) * ema
    return {
      date: r.date,
      weightKg: r.weightKg,
      trend: Math.round(ema * 10) / 10,
    }
  })
}

interface LiftSet {
  weightKg?: number | null
}

function topSetWeight(sets: unknown): number | null {
  if (!Array.isArray(sets)) return null
  const weights = (sets as LiftSet[])
    .map((s) => s?.weightKg)
    .filter((w): w is number => typeof w === 'number')
  return weights.length > 0 ? Math.max(...weights) : null
}

const ProgressPage = () => {
  const { data: metricsData } = useQuery(DAILY_METRICS_QUERY, {
    variables: { days: DAYS },
  })
  const { data: liftData } = useQuery(LIFT_ACTIVITIES_QUERY, {
    variables: { days: DAYS },
  })

  const weightSeries = useMemo(
    () => buildWeightSeries(metricsData?.dailyMetrics ?? []),
    [metricsData]
  )

  const exerciseNames = useMemo(() => {
    const names = new Set<string>()
    for (const activity of liftData?.liftActivities ?? []) {
      for (const exercise of activity.exercises) {
        names.add(exercise.name)
      }
    }
    return Array.from(names).sort()
  }, [liftData])

  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const activeExercise = selectedExercise ?? exerciseNames[0] ?? null

  const liftSeries = useMemo(() => {
    if (!activeExercise) return []
    const points: { date: string; weightKg: number }[] = []
    for (const activity of liftData?.liftActivities ?? []) {
      for (const exercise of activity.exercises) {
        if (exercise.name !== activeExercise) continue
        const top = topSetWeight(exercise.sets)
        if (top != null) {
          points.push({
            date: activity.startedAt.slice(0, 10),
            weightKg: top,
          })
        }
      }
    }
    return points
  }, [liftData, activeExercise])

  return (
    <>
      <Metadata title="Progress" description="Weight and lift progression" />
      <PageHeader title="Progress" subtitle="Weight trend & lift progression" />

      <section className="tf-plan-section">
        <h2>Weight trend</h2>
        {weightSeries.length > 0 ? (
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={weightSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  name="Weight (kg)"
                  stroke="var(--tf-text-muted)"
                  dot={{ r: 2 }}
                  strokeWidth={1}
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  name="Trend (EMA)"
                  stroke="var(--tf-accent)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="tf-empty">
            No weight data logged yet — weight synced from HealthKit or entered
            on your profile will show up here.
          </p>
        )}
      </section>

      <section className="tf-plan-section">
        <h2>Lift progression</h2>
        {exerciseNames.length > 0 ? (
          <>
            <label className="tf-field" style={{ maxWidth: 280 }}>
              <span>Exercise</span>
              <select
                value={activeExercise ?? ''}
                onChange={(e) => setSelectedExercise(e.target.value)}
              >
                {exerciseNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            {liftSeries.length > 0 ? (
              <div style={{ width: '100%', height: 280, marginTop: '1rem' }}>
                <ResponsiveContainer>
                  <LineChart data={liftSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="weightKg"
                      name="Top set (kg)"
                      stroke="var(--tf-accent)"
                      dot={{ r: 3 }}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="tf-empty">
                No weighted sets logged for {activeExercise} yet.
              </p>
            )}
          </>
        ) : (
          <p className="tf-empty">
            No Hevy workouts synced yet — connect Hevy in Settings to see lift
            progression here.
          </p>
        )}
      </section>
    </>
  )
}

export default ProgressPage
