import type { ActivityBaseline, Sex } from 'types/graphql'

import {
  Form,
  Label,
  TextField,
  SelectField,
  DateField,
  NumberField,
  Submit,
  FieldError,
} from '@cedarjs/forms'

// Every energy calculation (todayEnergySummary, the plan generator's
// timezone) depends on a Profile existing — this is the onboarding/edit
// form for one. No donor equivalent; there was never a UI for this before.

export interface ProfileFormValues {
  sex: Sex
  birthDate: string
  heightCm: number
  goalWeightKg?: number
  weeklyWeightDeltaKg?: number
  activityBaseline: ActivityBaseline
  proteinTargetGPerDay?: number
  timezone: string
  currentWeightKg?: number
}

interface ProfileFormProps {
  defaultValues?: Partial<ProfileFormValues>
  onSave?: (values: ProfileFormValues) => unknown
  saving?: boolean
}

const numberOrUndefined = (value: string): number | undefined =>
  value === '' ? undefined : Number(value)

const ProfileForm = ({
  defaultValues,
  onSave = () => {},
  saving = false,
}: ProfileFormProps) => {
  const onSubmit = (data: Record<string, string>) => {
    onSave({
      sex: data.sex as Sex,
      birthDate: data.birthDate,
      heightCm: Number(data.heightCm),
      goalWeightKg: numberOrUndefined(data.goalWeightKg),
      weeklyWeightDeltaKg: numberOrUndefined(data.weeklyWeightDeltaKg),
      activityBaseline: data.activityBaseline as ActivityBaseline,
      proteinTargetGPerDay: numberOrUndefined(data.proteinTargetGPerDay),
      timezone: data.timezone,
      currentWeightKg: numberOrUndefined(data.currentWeightKg),
    })
  }

  return (
    <Form onSubmit={onSubmit} className="tf-form">
      <Label name="sex" className="tf-label">
        Sex
      </Label>
      <SelectField
        name="sex"
        defaultValue={defaultValues?.sex ?? 'MALE'}
        className="tf-input"
        validation={{ required: true }}
      >
        <option value="MALE">Male</option>
        <option value="FEMALE">Female</option>
      </SelectField>
      <FieldError name="sex" className="tf-field-error" />

      <Label name="birthDate" className="tf-label">
        Birth date
      </Label>
      <DateField
        name="birthDate"
        defaultValue={defaultValues?.birthDate?.slice(0, 10)}
        className="tf-input"
        validation={{ required: 'Birth date is required' }}
      />
      <FieldError name="birthDate" className="tf-field-error" />

      <Label name="heightCm" className="tf-label">
        Height (cm)
      </Label>
      <NumberField
        name="heightCm"
        defaultValue={defaultValues?.heightCm}
        className="tf-input"
        validation={{ required: 'Height is required', min: 50, max: 250 }}
      />
      <FieldError name="heightCm" className="tf-field-error" />

      <Label name="currentWeightKg" className="tf-label">
        Current weight (kg)
      </Label>
      <NumberField
        name="currentWeightKg"
        defaultValue={defaultValues?.currentWeightKg}
        className="tf-input"
        validation={{ min: 20, max: 300 }}
      />
      <p className="tf-form-hint">
        Used for your calorie target until a HealthKit-synced weight exists.
      </p>
      <FieldError name="currentWeightKg" className="tf-field-error" />

      <Label name="activityBaseline" className="tf-label">
        Non-exercise activity level
      </Label>
      <SelectField
        name="activityBaseline"
        defaultValue={defaultValues?.activityBaseline ?? 'SEDENTARY'}
        className="tf-input"
      >
        <option value="SEDENTARY">Sedentary (desk job, little walking)</option>
        <option value="LIGHT">Light (some walking/standing)</option>
        <option value="MODERATE">Moderate</option>
        <option value="ACTIVE">Active</option>
        <option value="VERY_ACTIVE">Very active</option>
      </SelectField>
      <FieldError name="activityBaseline" className="tf-field-error" />

      <Label name="goalWeightKg" className="tf-label">
        Goal weight (kg, optional)
      </Label>
      <NumberField
        name="goalWeightKg"
        defaultValue={defaultValues?.goalWeightKg}
        className="tf-input"
        validation={{ min: 20, max: 300 }}
      />
      <FieldError name="goalWeightKg" className="tf-field-error" />

      <Label name="weeklyWeightDeltaKg" className="tf-label">
        Weekly weight change target (kg, optional)
      </Label>
      <NumberField
        name="weeklyWeightDeltaKg"
        defaultValue={defaultValues?.weeklyWeightDeltaKg}
        className="tf-input"
        step="0.1"
        validation={{ min: -1.0, max: 0.5 }}
      />
      <p className="tf-form-hint">
        Negative for a deficit (e.g. -0.4), positive for a surplus. Clamped to a
        safe range of -1.0 to 0.5 kg/week.
      </p>
      <FieldError name="weeklyWeightDeltaKg" className="tf-field-error" />

      <Label name="proteinTargetGPerDay" className="tf-label">
        Protein target (g/day, optional override)
      </Label>
      <NumberField
        name="proteinTargetGPerDay"
        defaultValue={defaultValues?.proteinTargetGPerDay}
        className="tf-input"
        validation={{ min: 0 }}
      />
      <FieldError name="proteinTargetGPerDay" className="tf-field-error" />

      <Label name="timezone" className="tf-label">
        Timezone
      </Label>
      <TextField
        name="timezone"
        defaultValue={
          defaultValues?.timezone ??
          Intl.DateTimeFormat().resolvedOptions().timeZone
        }
        className="tf-input"
        validation={{ required: 'Timezone is required' }}
      />
      <p className="tf-form-hint">
        IANA timezone name (e.g. Australia/Melbourne) — drives every
        &quot;today&quot; calculation in the app.
      </p>
      <FieldError name="timezone" className="tf-field-error" />

      <div className="tf-form-actions">
        <Submit disabled={saving} className="tf-button">
          {saving ? 'Saving…' : 'Save profile'}
        </Submit>
      </div>
    </Form>
  )
}

export default ProfileForm
