import React, { useEffect, useState } from "react"
import { api } from "../api"
import { useNavigate } from "react-router-dom"

export default function SchoolDashboard() {
  const [data, setData] = useState<any>(null)
  const [classMap, setClassMap] = useState<Record<string,string>>({})
  const nav = useNavigate()

  useEffect(() => {
    // fetch dashboard data
    api.get("/dashboard/")
      .then(res => setData(res.data))
      .catch(err => console.error("dashboard error", err))

    // try a list of likely endpoints for classes/classrooms and build id->name map
    const classEndpoints = ["/classes/", "/classrooms/", "/class/"]
    const buildMapFromResponse = (arr:any[]) => {
      const map: Record<string,string> = {}
      arr.forEach((cl:any) => {
        // try common id fields
        const id = String(cl.id ?? cl.pk ?? cl.classroom_id ?? cl.classroom ?? cl.value ?? "")
        // try common name fields
        const name = cl.name ?? cl.classroom_name ?? cl.class_name ?? cl.standard ?? cl.label ?? cl.classroom ?? null
        if (id) {
          map[id] = String(name ?? id)
        }
      })
      return map
    }

    const tryFetchClasses = async () => {
      for (const ep of classEndpoints) {
        try {
          const res = await api.get(ep)
          // Expecting an array of classes. If api returns object with results, try that too.
          const body = Array.isArray(res.data) ? res.data : (Array.isArray(res.data.results) ? res.data.results : null)
          if (Array.isArray(body)) {
            setClassMap(buildMapFromResponse(body))
            return
          }
          // If response is a map of id->name already
          if (res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
            // try to detect a simple mapping
            const maybeMap: Record<string,string> = {}
            let foundMapping = false
            Object.entries(res.data).forEach(([k, v]) => {
              if (typeof v === "string" || typeof v === "number") {
                maybeMap[String(k)] = String(v)
                foundMapping = true
              }
            })
            if (foundMapping) {
              setClassMap(maybeMap)
              return
            }
          }
          // fallback: if single object with known keys
          if (res.data && res.data.id && (res.data.name || res.data.classroom_name)) {
            const id = String(res.data.id)
            const name = res.data.name ?? res.data.classroom_name
            setClassMap({ [id]: String(name) })
            return
          }
        } catch (err) {
          // try next endpoint
          // console.warn(`failed to load ${ep}`, err)
        }
      }
      // if we reach here, no classes endpoint succeeded — keep classMap empty
      console.warn("Could not load classes list from any endpoint. Class names will fallback to IDs.")
    }

    tryFetchClasses()
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
                {Array.isArray(data.class_counts) && data.class_counts.map((c:any) => {
                  // derive an id key from multiple possible fields
                  const id = String(c.classroom ?? c.classroom_id ?? c.classroom__id ?? c.id ?? "")
                  // prefer classMap, then any classroom_name from payload, then fall back to id
                  const name = (id && classMap[id]) || c.classroom_name || c.class_name || c.standard || c.classroom || id
                  return (
                    <tr key={id || Math.random()}>
                      <td>{name}</td>
                      <td>{c.total}</td>
                      <td>{c.pending}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
