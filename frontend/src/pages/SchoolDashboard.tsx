import React, { useEffect, useState } from "react"
import { api } from "../api"
import { useNavigate } from "react-router-dom"

export default function SchoolDashboard() {
  const [data, setData] = useState<any>(null)
  const nav = useNavigate()

  useEffect(() => {
    api.get("/dashboard/").then(res => setData(res.data)).catch(err => console.error(err))
  }, [])

  if (!data) return <div className="app-container card">Loading...</div>

  return (
    <div className="app-container">
      <div className="card">
        <h2>School Dashboard</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 12 }}>
          <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => nav("/school/students")}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.students}</div>
            <div className="helper">Students</div>
          </div>

          <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => nav("/school/submissions")}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.parents_submitted}</div>
            <div className="helper">Parents Submitted</div>
          </div>

          <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => nav("/school/idcards/pending")}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.id_pending}</div>
            <div className="helper">Pending (class wise)</div>
          </div>
        </div>

        {/* class wise breakdown */}
        <div style={{ marginTop: 16 }}>
          <h4>Class-wise counts</h4>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Class</th><th>Total</th><th>Pending</th></tr></thead>
              <tbody>
                {data.class_counts.map((c:any) => (
                  <tr key={c.classroom__id}>
                    <td>{c.classroom|| c.classroom_id}</td>
                    <td>{c.total}</td>
                    <td>{c.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
