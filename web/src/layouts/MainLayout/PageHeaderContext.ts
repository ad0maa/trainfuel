import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export interface PageHeaderInfo {
  title: string
  subtitle?: string
  action?: ReactNode
}

interface PageHeaderContextValue {
  header: PageHeaderInfo | null
  setHeader: (header: PageHeaderInfo | null) => void
}

// Default (no-op) value lets a page render outside MainLayout — e.g. the
// generated `render(<DashboardPage />)` isolation tests — without needing a
// provider in the tree.
export const PageHeaderContext = createContext<PageHeaderContextValue>({
  header: null,
  setHeader: () => {},
})

export function usePageHeaderContext(): PageHeaderContextValue {
  return useContext(PageHeaderContext)
}
