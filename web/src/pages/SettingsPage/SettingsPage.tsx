import { useEffect, useRef } from 'react'

import type {
  ConnectStravaMutation,
  ConnectStravaMutationVariables,
} from 'types/graphql'

import { navigate, useLocation } from '@cedarjs/router'
import { Metadata, useMutation } from '@cedarjs/web'
import type { TypedDocumentNode } from '@cedarjs/web'
import { toast } from '@cedarjs/web/toast'

import StravaIntegrationCell from 'src/components/StravaIntegrationCell'

// STRAVA_OAUTH_REDIRECT_URI (.env.example) points straight at this page —
// Strava's redirect lands here as `/settings?code=...&scope=...`, and this
// component reads the code itself rather than needing a dedicated
// sub-route. See DECISIONS.md "M3".

const CONNECT_STRAVA_MUTATION: TypedDocumentNode<
  ConnectStravaMutation,
  ConnectStravaMutationVariables
> = gql`
  mutation ConnectStravaMutation($code: String!) {
    connectStrava(code: $code) {
      connected
      status
    }
  }
`

const SettingsPage = () => {
  const { search } = useLocation()
  const handledCode = useRef<string | null>(null)

  const [connectStrava] = useMutation(CONNECT_STRAVA_MUTATION, {
    refetchQueries: ['StravaIntegrationQuery'],
    onError: (error) => toast.error(error.message),
    onCompleted: () =>
      toast.success('Strava connected — backfilling recent activities…'),
  })

  useEffect(() => {
    const params = new URLSearchParams(search)
    const code = params.get('code')
    const error = params.get('error')

    // Guards against double-submission (e.g. StrictMode's double-invoke, or
    // this effect re-running before the URL is cleaned up below).
    if (code && handledCode.current !== code) {
      handledCode.current = code
      connectStrava({ variables: { code } })
      navigate('/settings') // strip ?code= so a refresh doesn't resubmit it
    } else if (error) {
      toast.error(`Strava authorization was not granted (${error}).`)
      navigate('/settings')
    }
  }, [search, connectStrava])

  return (
    <>
      <Metadata title="Settings" description="Integrations and preferences" />

      <main className="tf-page">
        <header className="tf-page-header">
          <h1>Settings</h1>
        </header>

        <section className="tf-plan-section">
          <h2>Strava</h2>
          <StravaIntegrationCell />
        </section>
      </main>
    </>
  )
}

export default SettingsPage
