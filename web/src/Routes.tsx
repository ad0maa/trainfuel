// In this file, all Page components from 'src/pages` are auto-imported. Nested
// directories are supported, and should be uppercase. Each subdirectory will be
// prepended onto the component name.
//
// Examples:
//
// 'src/pages/HomePage/HomePage.js'         -> HomePage
// 'src/pages/Admin/BooksPage/BooksPage.js' -> AdminBooksPage

import { Router, Route, PrivateSet } from '@cedarjs/router'

import { useAuth } from './auth.js'

const Routes = () => {
  return (
    <Router useAuth={useAuth}>
      <Route path="/login" page={LoginPage} name="login" />
      <Route path="/signup" page={SignupPage} name="signup" />
      <Route path="/forgot-password" page={ForgotPasswordPage} name="forgotPassword" />
      <Route path="/reset-password" page={ResetPasswordPage} name="resetPassword" />
      <PrivateSet unauthenticated="login">
        {/* named "home" (not "dashboard") so the existing dbAuth pages'
            `navigate(routes.home())` post-login/signup/reset redirects
            keep working without touching four generated auth pages */}
        <Route path="/" page={DashboardPage} name="home" />
        <Route path="/plan" page={PlanPage} name="plan" />
        <Route path="/food-log" page={FoodLogPage} name="foodLog" />
      </PrivateSet>
      <Route notfound page={NotFoundPage} />
    </Router>
  )
}

export default Routes
