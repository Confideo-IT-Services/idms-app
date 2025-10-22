// frontend/src/pages/SchoolSubmissions.tsx
import { useEffect, useState } from "react";
import { api } from "../api";

type Student = {
  id: number;
  full_name?: string;
  fatherName?: string;
  parent_phone?: string;
  parent_email?: string;
  status: "SUBMITTED" | "VERIFIED" | "APPROVED";
  classroom?: number;
  meta?: Record<string, any>;
  photo?: string;
};

type ClassRoom = { id: number; class_name: string; section?: string | null };

export default function SchoolSubmissions() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [classroom, setClassroom] = useState<number | "">("");
  const [status, setStatus] = useState<"SUBMITTED" | "VERIFIED">("SUBMITTED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params: any = { status };
      if (classroom) params.classroom = classroom;
      const [st, cl] = await Promise.all([
        api.get("/students/", { params }),
        api.get("/classes/"),
      ]);
      setStudents(st.data.results ?? st.data);
      setClasses(cl.data.results ?? cl.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status, classroom]);

  async function verify(id: number) {
    await api.post(`/students/${id}/verify/`);
    await load();
  }

  const classLabel = (id?: number) => {
    const c = classes.find((x) => x.id === id);
    return c ? `${c.class_name}${c.section ? ` - ${c.section}` : ""}` : id;
  };

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Top blue line */}
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
          marginTop: 45,
          marginBottom: 20,
          color: "#2c7be5",
          fontSize: "26px",
          fontWeight: "bold",
        }}
      >
        School Submissions
      </h2>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as any)}
          style={inputStyle}
        >
          <option value="SUBMITTED">SUBMITTED (from parents)</option>
          <option value="VERIFIED">VERIFIED</option>
        </select>

        <select
          value={classroom}
          onChange={(e) =>
            setClassroom(e.target.value ? Number(e.target.value) : "")
          }
          style={inputStyle}
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.class_name}
              {c.section ? ` - ${c.section}` : ""}
            </option>
          ))}
        </select>

        <button style={buttonStyle} onClick={load}>
          Refresh
        </button>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

      {/* Table */}
      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 600,
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f1f1f1", textAlign: "left" }}>
                {["ID", "Name", "Class", "Status", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 8px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "24px",
                      color: "#777",
                    }}
                  >
                    No submissions found
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr
                    key={s.id}
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
                    <td style={tdStyle}>{s.id}</td>
                    <td style={tdStyle}>
                      {s.full_name || s.meta?.student_name || "-"}
                      {s.meta?.fatherName
                        ? ` (Father: ${s.meta.fatherName})`
                        : ""}
                    </td>
                    <td style={tdStyle}>{classLabel(s.classroom)}</td>
                    <td style={tdStyle}>{s.status}</td>
                    <td style={{ ...tdStyle, display: "flex", gap: 8 }}>
                      <button
                        style={{ ...buttonStyle, backgroundColor: "#6c757d" }}
                        onClick={() => setSelected(s.id)}
                      >
                        View
                      </button>
                      {s.status === "SUBMITTED" && (
                        <button
                          style={{ ...buttonStyle, backgroundColor: "#28a745" }}
                          onClick={() => verify(s.id)}
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      {selected !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: "#fff",
              maxWidth: 600,
              width: "90%",
              padding: 20,
              borderRadius: 10,
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                marginTop: 0,
                color: "#2c7be5",
                fontWeight: "bold",
              }}
            >
              Submission Details
            </h3>
            {(() => {
              const s = students.find((x) => x.id === selected);
              if (!s) return null;

              let rawPhoto =
                s.photo || s.meta?.photo || s.meta?.student_photo;
              let photoUrl = rawPhoto;
              if (rawPhoto && !rawPhoto.startsWith("http")) {
                photoUrl = `${import.meta.env.VITE_API_BASE_URL}${rawPhoto}`;
              }

              return (
                <>
                  {photoUrl && (
                    <img
                      src={photoUrl}
                      alt="student"
                      style={{
                        maxWidth: 150,
                        marginBottom: 10,
                        borderRadius: 8,
                      }}
                    />
                  )}
                  <pre
                    style={{
                      background: "#f7f7f7",
                      padding: 10,
                      borderRadius: 6,
                      maxHeight: "40vh",
                      overflow: "auto",
                      fontSize: 13,
                    }}
                  >
                    {JSON.stringify(s, null, 2)}
                  </pre>
                </>
              );
            })()}

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <button
                style={{ ...buttonStyle, backgroundColor: "#6c757d" }}
                onClick={() => setSelected(null)}
              >
                Close
              </button>
              {(() => {
                const s = students.find((x) => x.id === selected);
                return s?.status === "SUBMITTED" ? (
                  <button
                    style={{ ...buttonStyle, backgroundColor: "#28a745" }}
                    onClick={async () => {
                      await verify(s!.id);
                      setSelected(null);
                    }}
                  >
                    Verify
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 15,
  outline: "none",
  minWidth: 160,
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  backgroundColor: "#2c7be5",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.2s",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
};
