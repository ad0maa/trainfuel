import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { NavLink, routes } from '@cedarjs/router'

import { useAuth } from 'src/auth'

import { PageHeaderContext } from './PageHeaderContext'
import type { PageHeaderInfo } from './PageHeaderContext'
import { useTheme } from './useTheme'

type MainLayoutProps = {
  children?: ReactNode
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const [header, setHeader] = useState<PageHeaderInfo | null>(null)
  const contextValue = useMemo(() => ({ header, setHeader }), [header])
  const { currentUser, logOut } = useAuth()
  const { theme, setTheme } = useTheme()

  return (
    <PageHeaderContext.Provider value={contextValue}>
      <div className="tf-shell">
        <aside className="tf-sidebar">
          <div className="tf-sidebar-brand">
            <span className="tf-sidebar-mark">T</span>
            <span className="tf-sidebar-name">TrainFuel</span>
          </div>

          <div className="tf-sidebar-section">
            <div className="tf-sidebar-section-title">Menu</div>
            <nav className="tf-sidebar-nav">
              <NavLink
                to={routes.home()}
                className="tf-sidebar-link"
                activeClassName="tf-sidebar-link-active"
              >
                <span className="tf-sidebar-icon">◎</span>Today
              </NavLink>
              <NavLink
                to={routes.plan()}
                className="tf-sidebar-link"
                activeClassName="tf-sidebar-link-active"
              >
                <span className="tf-sidebar-icon">▤</span>Plan
              </NavLink>
              <NavLink
                to={routes.foodLog()}
                className="tf-sidebar-link"
                activeClassName="tf-sidebar-link-active"
              >
                <span className="tf-sidebar-icon">☷</span>Food Log
              </NavLink>
              <NavLink
                to={routes.progress()}
                className="tf-sidebar-link"
                activeClassName="tf-sidebar-link-active"
              >
                <span className="tf-sidebar-icon">📈</span>Progress
              </NavLink>
            </nav>
          </div>

          <div className="tf-sidebar-section">
            <div className="tf-sidebar-section-title">Tools</div>
            <nav className="tf-sidebar-nav">
              <NavLink
                to={routes.bmiCalculator()}
                className="tf-sidebar-link"
                activeClassName="tf-sidebar-link-active"
              >
                <span className="tf-sidebar-icon">⚖</span>BMI calculator
              </NavLink>
              <NavLink
                to={routes.tdeeCalculator()}
                className="tf-sidebar-link"
                activeClassName="tf-sidebar-link-active"
              >
                <span className="tf-sidebar-icon">🔥</span>TDEE calculator
              </NavLink>
            </nav>
          </div>

          <div className="tf-sidebar-footer">
            <NavLink
              to={routes.settings()}
              className="tf-sidebar-link"
              activeClassName="tf-sidebar-link-active"
            >
              <span className="tf-sidebar-icon">⚙</span>Settings
            </NavLink>
            <div className="tf-user-chip">
              <span className="tf-user-avatar">
                {(currentUser?.email ?? '?').slice(0, 2).toUpperCase()}
              </span>
              <div className="tf-user-chip-meta">
                <div className="tf-user-chip-email">{currentUser?.email}</div>
                <button
                  type="button"
                  className="tf-user-chip-logout"
                  onClick={() => logOut()}
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        </aside>

        <div className="tf-shell-main">
          <header className="tf-topbar">
            <div className="tf-topbar-titles">
              <h1>{header?.title}</h1>
              {header?.subtitle && (
                <span className="tf-topbar-subtitle">{header.subtitle}</span>
              )}
            </div>
            <div className="tf-topbar-actions">
              <div className="tf-theme-toggle" role="group" aria-label="Theme">
                <button
                  type="button"
                  aria-pressed={theme === 'light'}
                  className={
                    theme === 'light' ? 'tf-theme-toggle-active' : undefined
                  }
                  onClick={() => setTheme('light')}
                >
                  ◑
                </button>
                <button
                  type="button"
                  aria-pressed={theme === 'dark'}
                  className={
                    theme === 'dark' ? 'tf-theme-toggle-active' : undefined
                  }
                  onClick={() => setTheme('dark')}
                >
                  ◐
                </button>
              </div>
              {header?.action}
            </div>
          </header>

          <main className="tf-page">{children}</main>
        </div>
      </div>
    </PageHeaderContext.Provider>
  )
}

export default MainLayout
