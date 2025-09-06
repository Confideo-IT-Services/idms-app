// frontend/src/pages/AdminSubmissions.tsx
import { useEffect, useState } from "react"
import { api } from "../api"

export default function AdminSubmissions() {
  const [schools, setSchools] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [schoolId, setSchoolId] = useState<number | null>(null)
  const [classId, setClassId] = useState<number | null>(null)

  useEffect(() => {
    api.get("/schools/").then(res => setSchools(res.data))
  }, [])

  async function loadClasses(sid: number) {
    const { data } = await api.get(`/classes/?school=${sid}`)
    setClasses(data.results ?? data)
  }

  async function loadSubmissions() {
    if (!schoolId || !classId) {
      alert("Select school and class")
      return
    }
    const { data } = await api.get(`/students/submissions/?school=${schoolId}&classroom=${classId}`)
    setStudents(data)
  }

  async function downloadPDF() {
    if (!schoolId || !classId) return
    const res = await api.get(`/students/generate_ids/?school=${schoolId}&classroom=${classId}`, {
      responseType: "blob",
    })
    const url = URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "idcards.pdf")
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (

    <div className="app-container">
      <div className="card">
        <h2>Admin Submissions</h2>

        <select value={schoolId || ""} onChange={(e) => {
          const sid = Number(e.target.value)
          setSchoolId(sid)
          loadClasses(sid)
        }}>
          <option value="">Select School</option>
          {schools.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select value={classId || ""} onChange={(e) => setClassId(Number(e.target.value))}>
          <option value="">Select Class</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.class_name}</option>
          ))}
        </select>

        <button onClick={loadSubmissions}>Load Submissions</button>
        <button onClick={downloadPDF}>Generate ID Cards</button>

        <table className="table" border={1} style={{ marginTop: 20, width: "100%" }}>
          <thead>
            <tr><th>Name</th><th>Class</th><th>Phone</th><th>Status</th></tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                <td>{s.classroom?.class_name}</td>
                <td>{s.parent_phone}</td>
                <td>{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
