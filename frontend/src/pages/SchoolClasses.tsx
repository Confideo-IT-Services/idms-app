import { useEffect, useState } from "react";
import { api } from "../api";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

type ClassRoom = {
  id?: number;
  class_name: string;
  section?: string | null;
  total_students: number;
};

export default function SchoolClasses() {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/classes/");
      setClasses(data.results ?? data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function newClass() {
    setEditing({ class_name: "", section: "", total_students: 0 });
  }

  async function save() {
    if (!editing) return;
    try {
      if (editing.id) await api.put(`/classes/${editing.id}/`, editing);
      else await api.post(`/classes/`, editing);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this class?")) return;
    await api.delete(`/classes/${id}/`);
    await load();
  }

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Top line */}
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
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
          Classes
        </h2>
        <button
          onClick={newClass}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#2c7be5",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 14px",
            cursor: "pointer",
            fontWeight: 500,
            marginTop: 20,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#1a5fcc")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "#2c7be5")
          }
        >
          <FaPlus /> New Class
        </button>
      </div>

      {/* Loading / Error */}
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {/* Table */}
      {!loading && !editing && (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 600,
              textAlign: "center",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f1f1f1" }}>
                <th style={{ padding: "10px 8px", fontWeight: "bold" }}>Class</th>
                <th style={{ padding: "10px 8px", fontWeight: "bold" }}>Section</th>
                <th style={{ padding: "10px 8px", fontWeight: "bold" }}>
                  Total Students
                </th>
                <th style={{ padding: "10px 8px", fontWeight: "bold" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr
                  key={c.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    cursor: "default",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#fafafa")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <td style={{ padding: "10px 8px" }}>{c.class_name}</td>
                  <td style={{ padding: "10px 8px" }}>{c.section || "-"}</td>
                  <td style={{ padding: "10px 8px" }}>{c.total_students}</td>
                  <td
                    style={{
                      padding: "10px 8px",
                      display: "flex",
                      justifyContent: "center",
                      gap: 12,
                    }}
                  >
                    {/* Edit */}
                    <button
                      onClick={() => setEditing(c)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#2c7be5",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      <FaEdit size={18} title="Edit" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => remove(c.id!)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#e46e7a",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      <FaTrash size={18} title="Delete" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/New Class Form */}
      {editing && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 20,
            borderRadius: 10,
            marginTop: 20,
            backgroundColor: "#f9f9f9",
            maxWidth: 650,
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginBottom: 16, fontSize: 20, fontWeight: "bold" }}>
            {editing.id ? "Edit Class" : "New Class"}
          </h3>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1fr 1fr 1fr",
            }}
          >
            <input
              placeholder="Class Name"
              value={editing.class_name}
              onChange={(e) =>
                setEditing({ ...editing, class_name: e.target.value })
              }
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                outline: "none",
              }}
            />
            <input
              placeholder="Section (optional)"
              value={editing.section || ""}
              onChange={(e) =>
                setEditing({ ...editing, section: e.target.value })
              }
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                outline: "none",
              }}
            />
            <input
              placeholder="Total Students"
              type="number"
              value={editing.total_students}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  total_students: Number(e.target.value),
                })
              }
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <button
              onClick={save}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "none",
                backgroundColor: "#2c7be5",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(null)}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid #ccc",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
