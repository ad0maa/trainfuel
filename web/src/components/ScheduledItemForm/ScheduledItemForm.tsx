import type { ScheduledItemType } from 'types/graphql'

import {
  Form,
  Label,
  TextField,
  SelectField,
  DatetimeLocalField,
  NumberField,
  TextAreaField,
  Submit,
  FieldError,
} from '@cedarjs/forms'

export interface ScheduledItemFormValues {
  type: ScheduledItemType
  title: string
  description?: string
  scheduledAt: string
  durationMin?: number
}

interface ScheduledItemFormProps {
  onSave?: (values: ScheduledItemFormValues) => unknown
  onCancel?: () => void
  saving?: boolean
}

// Manual "add a session to this block" form (SPEC.md §7.1: "generate
// sessions within a block — manual creation in v1"). Deliberately does not
// support recurrence — recurring meds/supplement templates aren't managed
// from this form in M1 (see DECISIONS.md).
const ScheduledItemForm = ({
  onSave = () => {},
  onCancel,
  saving = false,
}: ScheduledItemFormProps) => {
  const onSubmit = (data: Record<string, string>) => {
    onSave({
      type: data.type as ScheduledItemType,
      title: data.title,
      description: data.description || undefined,
      scheduledAt: new Date(data.scheduledAt).toISOString(),
      durationMin: data.durationMin ? Number(data.durationMin) : undefined,
    })
  }

  return (
    <Form onSubmit={onSubmit} className="tf-form">
      <Label name="type" className="tf-label">
        Type
      </Label>
      <SelectField
        name="type"
        defaultValue="RUN"
        className="tf-input"
        validation={{ required: true }}
      >
        <option value="RUN">Run</option>
        <option value="LIFT">Lift</option>
        <option value="OTHER">Other</option>
      </SelectField>
      <FieldError name="type" className="tf-field-error" />

      <Label name="title" className="tf-label">
        Title
      </Label>
      <TextField
        name="title"
        className="tf-input"
        placeholder="W4 Tue: 6×800m intervals"
        validation={{ required: 'Title is required' }}
      />
      <FieldError name="title" className="tf-field-error" />

      <Label name="scheduledAt" className="tf-label">
        Date &amp; time
      </Label>
      <DatetimeLocalField
        name="scheduledAt"
        className="tf-input"
        validation={{ required: 'Date and time are required' }}
      />
      <FieldError name="scheduledAt" className="tf-field-error" />

      <Label name="durationMin" className="tf-label">
        Duration (minutes)
      </Label>
      <NumberField name="durationMin" className="tf-input" />
      <FieldError name="durationMin" className="tf-field-error" />

      <Label name="description" className="tf-label">
        Prescription / notes
      </Label>
      <TextAreaField
        name="description"
        className="tf-input"
        placeholder="Paces, sets/reps, dose…"
      />
      <FieldError name="description" className="tf-field-error" />

      <div className="tf-form-actions">
        <Submit disabled={saving} className="tf-button">
          {saving ? 'Saving…' : 'Add session'}
        </Submit>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="tf-button tf-button--secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </Form>
  )
}

export default ScheduledItemForm
