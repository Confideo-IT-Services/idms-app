import React, { useEffect, useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

export default function SchoolDashboard() {
  const [data, setData] = useState<any>(null);
  const [classMap, setClassMap] = useState<Record<string, string>>({});
  const nav = useNavigate();

  useEffect(() => {
    // fetch dashboard data
    api
      .get("/dashboard/")
      .then((res) => setData(res.data))
      .catch((err) => console.error("dashboard error", err));

    // try a list of likely endpoints for classes/classrooms and build id->name map
    const classEndpoints = ["/classes/", "/classrooms/", "/class/"];
    const buildMapFromResponse = (arr: any[]) => {
      const map: Record<string, string> = {};
      arr.forEach((cl: any) => {
        const id = String(
          cl.id ??
            cl.pk ??
            cl.classroom_id ??
            cl.classroom ??
            cl.value ??
            ""
        );
        const name =
          cl.name ??
          cl.classroom_name ??
          cl.class_name ??
          cl.standard ??
          cl.label ??
          cl.classroom ??
          null;
        if (id) {
          map[id] = String(name ?? id);
        }
      });
      return map;
    };

    const tryFetchClasses = async () => {
      for (const ep of classEndpoints) {
        try {
          const res = await api.get(ep);
          const body = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data.results)
            ? res.data.results
            : null;
          if (Array.isArray(body)) {
            setClassMap(buildMapFromResponse(body));
            return;
          }
          if (res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
            const maybeMap: Record<string, string> = {};
            let foundMapping = false;
            Object.entries(res.data).forEach(([k, v]) => {
              if (typeof v === "string" || typeof v === "number") {
                maybeMap[String(k)] = String(v);
                foundMapping = true;
              }
            });
            if (foundMapping) {
              setClassMap(maybeMap);
              return;
            }
          }
          if (res.data && res.data.id && (res.data.name || res.data.classroom_name)) {
            const id = String(res.data.id);
            const name = res.data.name ?? res.data.classroom_name;
            setClassMap({ [id]: String(name) });
            return;
          }
        } catch (err) {}
      }
      console.warn(
        "Could not load classes list from any endpoint. Class names will fallback to IDs."
      );
    };

    tryFetchClasses();
  }, []);

  if (!data)
    return (
      <div style={{ padding: 20 }}>
        <h3>Loading...</h3>
      </div>
    );

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Top Blue Line */}
      <div
        style={{
          height: 2,
          width: "100%",
          backgroundColor: "#2c7be5",
          marginTop: 30,
          borderRadius: 2,
        }}
      ></div>

      {/* Header */}
      <h2
        style={{
          margin: 0,
          marginTop: 40,
          marginBottom: 20,
          color: "#2c7be5",
          fontSize: "26px",
          fontWeight: "bold",
        }}
      >
        School Dashboard
      </h2>

      {/* Dashboard Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 16,
          marginBottom: 40,
        }}
      >
        <div
          style={cardStyle}
          onClick={() => nav("/school/students")}
        >
          <div style={cardValue}>{data.students}</div>
          <div style={cardLabel}>Students</div>
        </div>

        <div
          style={cardStyle}
          onClick={() => nav("/school/submissions")}
        >
          <div style={cardValue}>{data.parents_submitted}</div>
          <div style={cardLabel}>Parents Submitted</div>
        </div>

        <div
          style={cardStyle}
          onClick={() => nav("/school/idcards/pending")}
        >
          <div style={cardValue}>{data.id_pending}</div>
          <div style={cardLabel}>Verification-Pending</div>
        </div>
      </div>

      {/* Class-wise Table */}
      <div>
        <h4
          style={{
            marginTop: 10,
            marginBottom: 16,
            color: "#2c7be5",
            fontSize: "20px",
          }}
        >
          Class-wise Counts
        </h4>

        <div style={{ overflowX: "auto" }}>
  <table
    style={{
      width: "100%",
      borderCollapse: "collapse",
      minWidth: 600,
    }}
  >
    <thead>
      <tr style={{ backgroundColor: "#f1f1f1" }}>
        <th
          style={{
            padding: "10px 8px",
            fontWeight: 700,
            color: "#333",
            textAlign: "left",
          }}
        >
          Class
        </th>
        <th
          style={{
            padding: "10px 8px",
            fontWeight: 700,
            color: "#333",
            textAlign: "center",
          }}
        >
          Total
        </th>
        <th
          style={{
            padding: "10px 8px",
            fontWeight: 700,
            color: "#333",
            textAlign: "center",
          }}
        >
          Pending
        </th>
      </tr>
    </thead>
    <tbody>
      {Array.isArray(data.class_counts) && data.class_counts.length > 0 ? (
        data.class_counts.map((c: any) => {
          const id = String(
            c.classroom ?? c.classroom_id ?? c.classroom__id ?? c.id ?? ""
          );
          const name =
            (id && classMap[id]) ||
            c.classroom_name ||
            c.class_name ||
            c.standard ||
            c.classroom ||
            id;
          return (
            <tr
              key={id || Math.random()}
              style={{
                borderBottom: "1px solid #eee",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#fafafa")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <td style={{ padding: "10px 8px", textAlign: "left" }}>{name}</td>
              <td style={{ padding: "10px 8px", textAlign: "center" }}>
                {c.total}
              </td>
              <td style={{ padding: "10px 8px", textAlign: "center" }}>
                {c.pending}
              </td>
            </tr>
          );
        })
      ) : (
        <tr>
          <td
            colSpan={3}
            style={{
              textAlign: "center",
              padding: "24px",
              color: "#777",
            }}
          >
            No class data available
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
      </div>
    </div>
  );
}

/* ---- Reusable styles ---- */
const cardStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 16px",
  borderRadius: 10,
  backgroundColor: "#fff",
  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.08)",
  cursor: "pointer",
  transition: "transform 0.2s, box-shadow 0.2s",
};

const cardValue: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#2c7be5",
};

const cardLabel: React.CSSProperties = {
  fontSize: 16,
  marginTop: 6,
  color: "#333",
};

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontWeight: 600,
  color: "#333",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
};
