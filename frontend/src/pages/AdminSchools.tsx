import { useEffect, useState } from "react"
import { api } from "../api"

type School = {
  id?: number
  name: string
  address: string
  email: string
  phone: string
  created_at?: string
}

export default function AdminSchools() {
  const [schools, setSchools] = useState<School[]>([])
  const [editing, setEditing] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const { data } = await api.get("/schools/")
      setSchools(data.results ?? data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load schools")
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function newSchool() {
    setEditing({ name: "", address: "", email: "", phone: "" })
  }

  async function save() {
    if (!editing) return
    try {
      if (editing.id) await api.put(`/schools/${editing.id}/`, editing)
      else await api.post(`/schools/`, editing)
      setEditing(null)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed")
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this school?")) return
    await api.delete(`/schools/${id}/`)
    await load()
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Schools</h2>
        <button onClick={newSchool}>+ New School</button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !editing && (
        <table style={{ width: "100%", marginTop: 12 }}>
          <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
          <tbody>
            {schools.map(s => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td>{s.phone}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(s)}>Edit</button>
                  <button onClick={() => remove(s.id!)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginTop: 12 }}>
          <h3>{editing.id ? "Edit School" : "New School"}</h3>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
            <input placeholder="Name" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
            <input placeholder="Email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} />
            <input placeholder="Phone" value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
            <input placeholder="Address" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} />
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
