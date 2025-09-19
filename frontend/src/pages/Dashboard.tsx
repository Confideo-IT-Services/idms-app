import React, { useEffect, useState } from "react"
import { api } from "../api"
import { useNavigate } from "react-router-dom"

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const nav = useNavigate()

  useEffect(() => {
    api.get("/dashboard/").then(res => setData(res.data)).catch(err => console.error(err))
  }, [])

  if (!data) return <div className="app-container card">Loading...</div>

  return (
    <div className="app-container">
      <div className="card">
        <h2>Admin Dashboard</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginTop: 12 }}>
          <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => nav("/admin/schools")}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.schools}</div>
            <div className="helper">Schools</div>
          </div>

          <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => nav("/admin/students")}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.students}</div>
            <div className="helper">Total Students</div>
          </div>

          <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => nav("/admin/idcards/generated")}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.id_generated}</div>
            <div className="helper">ID Cards Generated</div>
          </div>

          <div className="card" style={{ textAlign: "center", cursor: "pointer" }} onClick={() => nav("/admin/idcards/pending")}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{data.id_pending}</div>
            <div className="helper">ID Cards Pending</div>
          </div>
        </div>
      </div>
    </div>
  )
}
