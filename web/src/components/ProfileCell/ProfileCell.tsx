import type {
  MyProfileQuery,
  MyProfileQueryVariables,
  SaveProfileMutation,
  SaveProfileMutationVariables,
} from 'types/graphql'

import { useMutation } from '@cedarjs/web'
import type {
  CellSuccessProps,
  CellFailureProps,
  TypedDocumentNode,
} from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

import ProfileForm, { type ProfileFormValues } from 'src/components/ProfileForm'

export const QUERY: TypedDocumentNode<MyProfileQuery, MyProfileQueryVariables> =
  gql`
    query MyProfileQuery {
      myProfile {
        id
        sex
        birthDate
        heightCm
        goalWeightKg
        weeklyWeightDeltaKg
        activityBaseline
        proteinTargetGPerDay
        timezone
        currentWeightKg
      }
    }
  `

const SAVE_PROFILE_MUTATION: TypedDocumentNode<
  SaveProfileMutation,
  SaveProfileMutationVariables
> = gql`
  mutation SaveProfileMutation($input: SaveProfileInput!) {
    saveProfile(input: $input) {
      id
    }
  }
`

export const Loading = () => <div className="tf-loading">Loading profile…</div>

// Deliberately no `Empty` export — Cedar's cell only routes to Empty when
// both the data is "empty" (myProfile: null for a brand-new user) *and*
// Empty is exported. Skipping it means Success always renders, and Success
// itself handles "no profile yet" as the onboarding case for the same form.

export const Failure = ({
  error,
}: CellFailureProps<MyProfileQueryVariables>) => (
  <div style={{ color: 'red' }}>Error: {error?.message}</div>
)

export const Success = ({
  myProfile,
}: CellSuccessProps<MyProfileQuery, MyProfileQueryVariables>) => {
  const [saveProfile, { loading }] = useMutation(SAVE_PROFILE_MUTATION, {
    refetchQueries: ['MyProfileQuery', 'TodayEnergySummaryQuery'],
    onError: (error) => toast.error(error.message),
    onCompleted: () => toast.success('Profile saved'),
  })

  const handleSave = (values: ProfileFormValues) => {
    saveProfile({ variables: { input: values } })
  }

  return (
    <div className="tf-profile-section">
      {!myProfile && (
        <p className="tf-form-hint">
          Complete your profile to unlock daily energy targets on the Dashboard.
        </p>
      )}
      <ProfileForm
        defaultValues={myProfile ?? undefined}
        onSave={handleSave}
        saving={loading}
      />
    </div>
  )
}
