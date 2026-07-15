import type { BlockPhase } from 'types/graphql'

import {
  Form,
  Label,
  TextField,
  SelectField,
  DateField,
  TextAreaField,
  Submit,
  FieldError,
} from '@cedarjs/forms'

export interface TrainingBlockFormValues {
  name: string
  phase: BlockPhase
  startDate: string
  endDate: string
  notes?: string
}

interface TrainingBlockFormProps {
  defaultValues?: Partial<TrainingBlockFormValues>
  // Returning a Promise<unknown> covers Apollo mutate() results without
  // forcing every caller to discard the return value explicitly.
  onSave?: (values: TrainingBlockFormValues) => unknown
  onCancel?: () => void
  saving?: boolean
  submitLabel?: string
}

// Create/edit form for a TrainingBlock. Reused by TrainingBlocksCell for
// both "new block" and "edit block" — pass `defaultValues` to pre-fill for
// editing.
const TrainingBlockForm = ({
  defaultValues,
  onSave = () => {},
  onCancel,
  saving = false,
  submitLabel = 'Save block',
}: TrainingBlockFormProps) => {
  const onSubmit = (data: Record<string, string>) => {
    onSave({
      name: data.name,
      phase: data.phase as BlockPhase,
      startDate: data.startDate,
      endDate: data.endDate,
      notes: data.notes || undefined,
    })
  }

  return (
    <Form onSubmit={onSubmit} className="tf-form">
      <Label name="name" className="tf-label">
        Name
      </Label>
      <TextField
        name="name"
        defaultValue={defaultValues?.name}
        className="tf-input"
        validation={{ required: 'Name is required' }}
      />
      <FieldError name="name" className="tf-field-error" />

      <Label name="phase" className="tf-label">
        Phase
      </Label>
      <SelectField
        name="phase"
        defaultValue={defaultValues?.phase ?? 'BUILD'}
        className="tf-input"
        validation={{ required: true }}
      >
        <option value="REBUILD">Rebuild</option>
        <option value="BUILD">Build</option>
        <option value="TAPER">Taper</option>
        <option value="MAINTENANCE">Maintenance</option>
      </SelectField>
      <FieldError name="phase" className="tf-field-error" />

      <Label name="startDate" className="tf-label">
        Start date
      </Label>
      <DateField
        name="startDate"
        defaultValue={defaultValues?.startDate?.slice(0, 10)}
        className="tf-input"
        validation={{ required: 'Start date is required' }}
      />
      <FieldError name="startDate" className="tf-field-error" />

      <Label name="endDate" className="tf-label">
        End date
      </Label>
      <DateField
        name="endDate"
        defaultValue={defaultValues?.endDate?.slice(0, 10)}
        className="tf-input"
        validation={{ required: 'End date is required' }}
      />
      <FieldError name="endDate" className="tf-field-error" />

      <Label name="notes" className="tf-label">
        Notes
      </Label>
      <TextAreaField
        name="notes"
        defaultValue={defaultValues?.notes}
        className="tf-input"
      />
      <FieldError name="notes" className="tf-field-error" />

      <div className="tf-form-actions">
        <Submit disabled={saving} className="tf-button">
          {saving ? 'Saving…' : submitLabel}
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

export default TrainingBlockForm
