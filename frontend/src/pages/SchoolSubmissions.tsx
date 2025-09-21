// frontend/src/pages/SchoolSubmissions.tsx
import { useEffect, useState } from "react"
import { api } from "../api"

type Student = {
  id: number
  full_name?: string
  fatherName?: string
  parent_phone?: string
  parent_email?: string
  status: "SUBMITTED" | "VERIFIED" | "APPROVED"
  classroom?: number
  meta?: Record<string, any>
  photo?: string  // DRF may return URL if using dev media
}

type ClassRoom = { id: number; class_name: string; section?: string | null }

export default function SchoolSubmissions() {
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [classroom, setClassroom] = useState<number | "">("")
  const [status, setStatus] = useState<"SUBMITTED" | "VERIFIED">("SUBMITTED")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null) // for details modal-ish

  async function load() {
    setLoading(true); setError(null)
    try {
      const params: any = { status }
      if (classroom) params.classroom = classroom
      const [st, cl] = await Promise.all([
        api.get("/students/", { params }),
        api.get("/classes/"),
      ])
      setStudents(st.data.results ?? st.data)
      setClasses(cl.data.results ?? cl.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load submissions")
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [status, classroom])

  async function verify(id: number) {
    await api.post(`/students/${id}/verify/`)
    await load()
  }

  const classLabel = (id?: number) => {
    const c = classes.find(x => x.id === id)
    return c ? `${c.class_name}${c.section ? ` - ${c.section}` : ""}` : id
  }

  return (
    <div className="app-container">
      <div className="card">
        <h2>Submissions</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={status} onChange={e => setStatus(e.target.value as any)}>
            <option value="SUBMITTED">SUBMITTED (from parents)</option>
            <option value="VERIFIED">VERIFIED</option>
          </select>
          <select value={classroom} onChange={e => setClassroom(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.class_name}{c.section ? ` - ${c.section}` : ""}
              </option>
            ))}
          </select>
          <button onClick={load}>Refresh</button>
        </div>

        {loading && <div>Loading…</div>}
        {error && <div style={{ color: "red" }}>{error}</div>}

        {!loading && (
          <table className="table" style={{ width: "100%", marginTop: 12 }}>
            <thead><tr><th>ID</th><th>Name</th><th>Class</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.full_name || s.meta?.student_name || "-"}
                    {s.meta?.fatherName ? ` (Father: ${s.meta.fatherName})` : ""}
                  </td>
                  <td>{classLabel(s.classroom)}</td>
                  <td>{s.status}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setSelected(s.id)}>View</button>
                    {s.status === "SUBMITTED" && <button onClick={() => verify(s.id)}>Verify</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Simple details panel */}
        {selected !== null && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)" }} onClick={() => setSelected(null)}>
            <div style={{ background: "#fff", maxWidth: 600, margin: "10vh auto", padding: 16, borderRadius: 8 }} onClick={e => e.stopPropagation()}>
              <h3>Submission Details</h3>
              {(() => {
                const s = students.find(x => x.id === selected)
                if (!s) return null
                return (
                  <>
                    {s.photo && <img src={s.photo} alt="student" style={{ maxWidth: 150, marginBottom: 10 }} />}
                    <pre style={{ background: "#f7f7f7", padding: 10, borderRadius: 6 }}>
                      {JSON.stringify(s, null, 2)}
                    </pre>
                  </>
                )
              })()}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setSelected(null)}>Close</button>
                {(() => {
                  const s = students.find(x => x.id === selected)
                  return s?.status === "SUBMITTED" ? (
                    <button onClick={async () => { await verify(s!.id); setSelected(null) }}>Verify</button>
                  ) : null
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
