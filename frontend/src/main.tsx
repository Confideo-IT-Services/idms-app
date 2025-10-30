// frontend/src/main.tsx
import "./styles.css"
// import App from "./App"
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionProvider, useSession } from './session'
import Login from './pages/Login'
import AdminLinks from './pages/AdminLinks'
import FormTemplates from './pages/FormTemplates'
import ParentUpload from './pages/ParentUpload'
import AdminSchools from './pages/AdminSchools'
import AdminUsers from './pages/AdminUsers'
import AdminSubmissions from "./pages/AdminSubmissions"
import AdminIdTemplates from "./pages/AdminIdTemplates"
import SchoolClasses from './pages/SchoolClasses'
import SchoolSubmissions from './pages/SchoolSubmissions'
import SchoolUploadLinks from './pages/AdminLinks'
import ResetPassword from "./pages/ResetPassword"


function RequireAuth({ children }: { children: JSX.Element }) {
  const { me, loading } = useSession()
  if (loading) return <div style={{padding:20}}>Loading…</div>
  if (!me) return <Navigate to="/login" />
  return children
}

import AuthedLayout from './layouts/AuthedLayout'
import SchoolDashboard from "./pages/SchoolDashboard"
import Dashboard from "./pages/Dashboard"

function AppRoutes() {
  return (
          
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login onLogin={() => location.replace('/')} />} />
      <Route path="/u/:token" element={<ParentUpload />} />

      {/* reset password - accept either query or path token */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />


      {/* Authed + Role-based menu */}
      <Route path="/" element={<RequireAuth><AuthedLayout /></RequireAuth>}>
        {/* School Admin views */}
        <Route path="/school/dashboard" element={<SchoolDashboard />} />
        <Route index element={<RoleBasedDashboard />} />
        <Route path="templates" element={<FormTemplates />} />
        {/* Stubs: add your pages here */}
        <Route path="school/classes" element={<SchoolClasses />} />
        <Route path="school/submissions" element={<SchoolSubmissions />} />
        <Route path="school/upload-links" element={<SchoolUploadLinks />} />

        {/* Super Admin views */}
        <Route path="/admin/dashboard" element={<Dashboard />} />
        <Route path="admin/schools" element={<AdminSchools />} />
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/id-templates" element={<AdminIdTemplates />} />
        <Route path="admin/submissions" element={<AdminSubmissions />} />
        {/* <Route path="admin/id-templates" element={<div>ID Templates (Print) (TODO)</div>} /> */}
        <Route path="admin/approvals" element={<div>Approvals & PDFs (TODO)</div>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

function RoleBasedDashboard() {
  const { me } = useSession()

  if (!me) return <Navigate to="/login" />

  // Example: adjust role keys to match your backend
  if (me.role === "SUPER_ADMIN") {
    return <Dashboard />
  }

  if (me.role === "SCHOOL_ADMIN") {
    return <SchoolDashboard />
  }

  // fallback if role is unknown
  return <div style={{ padding: 20 }}>No dashboard available for your role</div>
}


ReactDOM.createRoot(document.getElementById('root')!).render(
  <SessionProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </SessionProvider>
)
