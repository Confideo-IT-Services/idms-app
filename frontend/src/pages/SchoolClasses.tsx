// frontend/src/pages/SchoolClasses.tsx
import { useEffect, useState } from "react"
import { api } from "../api"

type ClassRoom = {
  id?: number
  class_name: string
  section?: string | null
  total_students: number
}

export default function SchoolClasses() {
  const [items, setItems] = useState<ClassRoom[]>([])
  const [editing, setEditing] = useState<ClassRoom | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const { data } = await api.get("/classes/")
      setItems(data.results ?? data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load classes")
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function newItem() {
    setEditing({ class_name: "", section: "", total_students: 0 })
  }

  async function save() {
    if (!editing) return
    try {
      if (editing.id) await api.put(`/classes/${editing.id}/`, editing)
      else await api.post(`/classes/`, editing)  // backend sets school = current user's school
      setEditing(null)
      await load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed")
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this class?")) return
    await api.delete(`/classes/${id}/`)
    await load()
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Classes</h2>
        <button onClick={newItem}>+ New Class</button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {!loading && !editing && (
        <table style={{ width: "100%", marginTop: 12 }}>
          <thead><tr><th>ID</th><th>Class</th><th>Section</th><th>Total</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.class_name}</td>
                <td>{c.section || "-"}</td>
                <td>{c.total_students}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(c)}>Edit</button>
                  <button onClick={() => remove(c.id!)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, marginTop: 12 }}>
          <h3>{editing.id ? "Edit Class" : "New Class"}</h3>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}>
            <input placeholder="Class (e.g., Grade 1)" value={editing.class_name} onChange={e => setEditing({ ...editing, class_name: e.target.value })} />
            <input placeholder="Section (optional)" value={editing.section || ""} onChange={e => setEditing({ ...editing, section: e.target.value })} />
            <input placeholder="Total students" type="number" value={editing.total_students} onChange={e => setEditing({ ...editing, total_students: Number(e.target.value) })} />
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
