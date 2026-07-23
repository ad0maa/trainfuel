import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { usePageHeaderContext } from 'src/layouts/MainLayout/PageHeaderContext'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

// Renders nothing itself — hands its title/subtitle/action to MainLayout's
// topbar via context, so each page keeps owning its own header content
// without every page re-implementing the topbar markup.
const PageHeader = ({ title, subtitle, action }: PageHeaderProps) => {
  const { setHeader } = usePageHeaderContext()

  useEffect(() => {
    setHeader({ title, subtitle, action })
    return () => setHeader(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, action])

  return null
}

export default PageHeader
