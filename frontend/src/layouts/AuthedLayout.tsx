// frontend/src/layouts/AuthedLayout.tsx  (replace the header area)
import { Link, Outlet, useNavigate } from "react-router-dom"
import { useSession } from "../session"
import { setAuth } from "../api"

export default function AuthedLayout() {
  const { me, loading } = useSession()
  const nav = useNavigate()

  if (loading) return <div style={{padding:20}}>Loading…</div>
  if (!me) { nav("/login"); return null }

  function logout() {
    localStorage.removeItem("access")
    localStorage.removeItem("refresh")
    setAuth(null)
    location.replace("/login")
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #eee", padding: 16 }}>
        <h3>Dashboard</h3>
        {me.role === "SUPER_ADMIN" ? (
          <nav style={{ display: "grid", gap: 8 }}>
            <Link to="/admin/schools">Schools</Link>
            <Link to="/admin/users">School Admins</Link>
            <Link to="/admin/templates">Templates</Link>
            <Link to="/admin/id-templates">ID Templates</Link>
            <Link to="/admin/submissions">Submissions</Link>
            {/* wh */}
          </nav>
        ) : (
          <nav style={{ display: "grid", gap: 8 }}>
            <Link to="/school/classes">Classes</Link>
            {/* <Link to="/templates">Form Templates</Link> */}
            <Link to="/">Upload Links</Link>
            <Link to="/school/submissions">Submissions</Link>
          </nav>
        )}
      </aside>
      <main style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, fontSize: 12, marginBottom: 10 }}>
          <span>{me.username} · {me.role}</span>
          <button onClick={logout}>Log out</button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
