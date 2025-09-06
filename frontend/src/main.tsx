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

function RequireAuth({ children }: { children: JSX.Element }) {
  const { me, loading } = useSession()
  if (loading) return <div style={{padding:20}}>Loading…</div>
  if (!me) return <Navigate to="/login" />
  return children
}

import AuthedLayout from './layouts/AuthedLayout'

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login onLogin={() => location.replace('/')} />} />
      <Route path="/u/:token" element={<ParentUpload />} />

      {/* Authed + Role-based menu */}
      <Route path="/" element={<RequireAuth><AuthedLayout /></RequireAuth>}>
        {/* School Admin views */}
        <Route index element={<AdminLinks />} />
        <Route path="templates" element={<FormTemplates />} />
        {/* Stubs: add your pages here */}
        <Route path="school/classes" element={<SchoolClasses />} />
        <Route path="school/submissions" element={<SchoolSubmissions />} />

        {/* Super Admin views */}
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <SessionProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </SessionProvider>
)
