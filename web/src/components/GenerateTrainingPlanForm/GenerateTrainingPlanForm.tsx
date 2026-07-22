import { useState } from 'react'

import type {
  GenerateTrainingPlanMutation,
  GenerateTrainingPlanMutationVariables,
  PlanGoalType,
} from 'types/graphql'

import {
  Form,
  Label,
  SelectField,
  DateField,
  NumberField,
  Submit,
  FieldError,
} from '@cedarjs/forms'
import { useMutation } from '@cedarjs/web'
import type { TypedDocumentNode } from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

// SPEC.md §7.1's "template auto-generation" stretch goal, ported from the
// donor Django repo's plan engine — see CONSOLIDATION_PLAN.md Phase 1 /
// DECISIONS.md "M2.5". This is the only new web surface M2.5 needs: submit
// a goal + current fitness (+ optional race date) and the server persists a
// full set of TrainingBlocks/ScheduledItems, which the existing
// TrainingBlocksCell/WeekScheduledItemsCell already know how to render.

const GENERATE_TRAINING_PLAN_MUTATION: TypedDocumentNode<
  GenerateTrainingPlanMutation,
  GenerateTrainingPlanMutationVariables
> = gql`
  mutation GenerateTrainingPlanMutation($input: GenerateTrainingPlanInput!) {
    generateTrainingPlan(input: $input) {
      entryWeekNo
      feasibility {
        isFeasible
        weeksRemaining
        suggestedGoalDate
        message
      }
      blocks {
        id
      }
    }
  }
`

const GOAL_OPTIONS: { value: PlanGoalType; label: string }[] = [
  { value: 'COUCH_TO_5K', label: 'Couch to 5K' },
  { value: 'FIVE_K', label: '5K' },
  { value: 'TEN_K', label: '10K' },
  { value: 'HALF_MARATHON', label: 'Half Marathon' },
]

interface FormFields {
  goalType: PlanGoalType
  currentWeeklyKm?: string
  startDate: string
  goalDate?: string
}

const GenerateTrainingPlanForm = () => {
  const [showForm, setShowForm] = useState(false)
  const [goalType, setGoalType] = useState<PlanGoalType>('FIVE_K')

  const [generatePlan, { loading }] = useMutation(
    GENERATE_TRAINING_PLAN_MUTATION,
    {
      refetchQueries: ['TrainingBlocksQuery', 'ScheduledItemsForWeekQuery'],
      onError: (error) => toast.error(error.message),
      onCompleted: ({ generateTrainingPlan: result }) => {
        setShowForm(false)
        if (result.feasibility && !result.feasibility.isFeasible) {
          toast(result.feasibility.message, { icon: '⚠️', duration: 8000 })
        } else {
          toast.success(
            `Plan generated: ${result.blocks.length} block${
              result.blocks.length === 1 ? '' : 's'
            }`
          )
        }
      },
    }
  )

  const submit = (data: FormFields, confirmOverlap = false) => {
    generatePlan({
      variables: {
        input: {
          goalType: data.goalType,
          currentWeeklyKm: data.currentWeeklyKm
            ? Number(data.currentWeeklyKm)
            : 0,
          startDate: data.startDate,
          goalDate: data.goalDate || null,
          confirmOverlap,
        },
      },
    }).catch((error) => {
      // The overlap guard (see api/src/services/trainingPlans/trainingPlans.ts)
      // rejects rather than silently double-booking — offer the confirm
      // here rather than making the user re-fill and resubmit the form.
      if (
        /overlap/i.test(error.message) &&
        confirm(`${error.message}\n\nGenerate anyway?`)
      ) {
        submit(data, true)
      }
    })
  }

  const onSubmit = (data: FormFields) => submit(data, false)

  if (!showForm) {
    return (
      <button type="button" onClick={() => setShowForm(true)}>
        + Generate plan
      </button>
    )
  }

  return (
    <Form onSubmit={onSubmit} className="tf-form">
      <Label name="goalType" className="tf-label">
        Goal
      </Label>
      <SelectField
        name="goalType"
        className="tf-input"
        defaultValue={goalType}
        onChange={(e) => setGoalType(e.target.value as PlanGoalType)}
        validation={{ required: true }}
      >
        {GOAL_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </SelectField>
      <FieldError name="goalType" className="tf-field-error" />

      <Label name="currentWeeklyKm" className="tf-label">
        Current weekly volume (km)
      </Label>
      <NumberField
        name="currentWeeklyKm"
        className="tf-input"
        disabled={goalType === 'COUCH_TO_5K'}
        validation={{ min: 0 }}
      />
      {goalType === 'COUCH_TO_5K' && (
        <p className="tf-form-hint">
          Couch to 5K is duration-based — it always starts at week 1.
        </p>
      )}
      <FieldError name="currentWeeklyKm" className="tf-field-error" />

      <Label name="startDate" className="tf-label">
        Start date
      </Label>
      <DateField
        name="startDate"
        className="tf-input"
        defaultValue={new Date().toISOString().slice(0, 10)}
        validation={{ required: 'Start date is required' }}
      />
      <p className="tf-form-hint">
        Sessions are anchored to the Monday on/after this date.
      </p>
      <FieldError name="startDate" className="tf-field-error" />

      <Label name="goalDate" className="tf-label">
        Goal / race date (optional)
      </Label>
      <DateField name="goalDate" className="tf-input" />
      <p className="tf-form-hint">
        Checked against a safe progression — a warning is shown if it&apos;s too
        soon, but the plan is generated either way.
      </p>
      <FieldError name="goalDate" className="tf-field-error" />

      <div className="tf-form-actions">
        <Submit disabled={loading} className="tf-button">
          {loading ? 'Generating…' : 'Generate plan'}
        </Submit>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="tf-button tf-button--secondary"
        >
          Cancel
        </button>
      </div>
    </Form>
  )
}

export default GenerateTrainingPlanForm
