import { useEffect, useState } from "react"
import { api } from "../api"

type School = { id: number; name: string }
type User = {
  id?: number
  username: string
  password?: string
  first_name?: string
  last_name?: string
  email?: string
  role: "SCHOOL_ADMIN"
  school: number
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [editing, setEditing] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [u, s] = await Promise.all([api.get("/users/"), api.get("/schools/")])
      setUsers(u.data.results ?? u.data)
      setSchools(s.data.results ?? s.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load users")
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function newUser() {
    setEditing({ username: "", password: "", first_name: "", last_name: "", email: "", role: "SCHOOL_ADMIN", school: schools[0]?.id || 0 })
  }

  async function save() {
    if (!editing) return
    try {
      const payload = { ...editing }
      if (!payload.password) delete payload.password  // don’t send empty on update
      if (editing.id) await api.put(`/users/${editing.id}/`, payload)
      else await api.post(`/users/`, payload)
      setEditing(null)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed")
    }
  }

  async function resetPassword(id: number) {
    const pwd = prompt("Enter new password")
    if (!pwd) return
    await api.post(`/users/${id}/reset_password/`, { password: pwd })
    alert("Password updated")
  }

  async function remove(id: number) {
    if (!confirm("Delete this user?")) return
    await api.delete(`/users/${id}/`)
    await load()
  }

  const schoolName = (id?: number) => schools.find(s => s.id === id)?.name || id

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>School Admins</h2>
        <button onClick={newUser}>+ New School Admin</button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !editing && (
        <table style={{ width: "100%", marginTop: 12 }}>
          <thead><tr><th>ID</th><th>Username</th><th>Name</th><th>Email</th><th>School</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{[u.first_name, u.last_name].filter(Boolean).join(" ")}</td>
                <td>{u.email}</td>
                <td>{schoolName(u.school)}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(u)}>Edit</button>
                  <button onClick={() => resetPassword(u.id!)}>Reset Password</button>
                  <button onClick={() => remove(u.id!)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginTop: 12 }}>
          <h3>{editing.id ? "Edit School Admin" : "New School Admin"}</h3>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <input placeholder="Username" value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} />
            <input placeholder="Password" type="password" value={editing.password || ""} onChange={e => setEditing({ ...editing, password: e.target.value })} />
            <input placeholder="First Name" value={editing.first_name || ""} onChange={e => setEditing({ ...editing, first_name: e.target.value })} />
            <input placeholder="Last Name" value={editing.last_name || ""} onChange={e => setEditing({ ...editing, last_name: e.target.value })} />
            <input placeholder="Email" value={editing.email || ""} onChange={e => setEditing({ ...editing, email: e.target.value })} />
            <select value={editing.school} onChange={e => setEditing({ ...editing, school: Number(e.target.value) })}>
              {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {/* Role is fixed to SCHOOL_ADMIN for this screen, but show it disabled */}
            <input value={editing.role} disabled />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={save}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
