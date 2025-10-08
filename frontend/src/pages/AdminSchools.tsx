import { useEffect, useState } from "react";
import { api } from "../api";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";

type School = {
  id?: number;
  name: string;
  address: string;
  email: string;
  phone: string;
  created_at?: string;
};

export default function AdminSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [editing, setEditing] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/schools/");
      setSchools(data.results ?? data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load schools");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function newSchool() {
    setEditing({ name: "", address: "", email: "", phone: "" });
  }

  async function save() {
    if (!editing) return;
    try {
      if (editing.id) await api.put(`/schools/${editing.id}/`, editing);
      else await api.post(`/schools/`, editing);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed");
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this school?")) return;
    await api.delete(`/schools/${id}/`);
    await load();
  }

  return (
    <div style={{ padding: 20, paddingLeft:0, paddingRight:0 }}>
      {/* Full-width top line */}
      <div style={{ height: 3, width: "100%", backgroundColor: "#2c7be5", marginTop: 30, borderRadius: 2 }}></div>

      {/* Header + New School button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, marginTop: 45, marginBottom: 20, color: "#2c7be5", fontSize: "26px", fontWeight: "bold" }}>Schools</h2>
        <button
          onClick={newSchool}
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
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1a5fcc")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2c7be5")}
        >
          <FaPlus /> New School
        </button>
      </div>

      {/* Loading / Error */}
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {/* School Table */}
      {!loading && !editing && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f1f1", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>ID</th>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>Email</th>
                <th style={{ padding: "10px 8px" }}>Phone</th>
                <th style={{ padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: "1px solid #eee", cursor: "default", transition: "background 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "10px 8px" }}>{s.id}</td>
                  <td style={{ padding: "10px 8px" }}>{s.name}</td>
                  <td style={{ padding: "10px 8px" }}>{s.email}</td>
                  <td style={{ padding: "10px 8px" }}>{s.phone}</td>
                  <td style={{ padding: "10px 8px", display: "flex", gap: 12 }}>
                    {/* Edit Button */}
                    <button
                      onClick={() => setEditing(s)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#2c7be5",
                        cursor: "pointer",
                        fontWeight: "bold",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        const text = e.currentTarget.querySelector(".button-text") as HTMLElement;
                        text.style.opacity = "1";
                        text.style.visibility = "visible";
                      }}
                      onMouseLeave={(e) => {
                        const text = e.currentTarget.querySelector(".button-text") as HTMLElement;
                        text.style.opacity = "0";
                        text.style.visibility = "hidden";
                      }}
                    >
                      <FaEdit size={18} />
                      <span
                        className="button-text"
                        style={{
                          position: "absolute",
                          bottom: "120%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          backgroundColor: "#fff",
                          color: "#333", // light black
                          border: "1px solid #ccc",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                          opacity: 0,
                          visibility: "hidden",
                          transition: "opacity 0.2s, transform 0.2s",
                          zIndex: 10,
                        }}
                      >
                        Edit
                      </span>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => remove(s.id!)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#e46e7aff",
                        cursor: "pointer",
                        fontWeight: "bold",
                        position: "relative",
                      }}
                      onMouseEnter={(e) => {
                        const text = e.currentTarget.querySelector(".button-text") as HTMLElement;
                        text.style.opacity = "1";
                        text.style.visibility = "visible";
                      }}
                      onMouseLeave={(e) => {
                        const text = e.currentTarget.querySelector(".button-text") as HTMLElement;
                        text.style.opacity = "0";
                        text.style.visibility = "hidden";
                      }}
                    >
                      <FaTrash size={18} />
                      <span
                        className="button-text"
                        style={{
                          position: "absolute",
                          bottom: "120%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          backgroundColor: "#fff",
                          color: "#333", // light black
                          border: "1px solid #ccc",
                          padding: "2px 6px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                          opacity: 0,
                          visibility: "hidden",
                          transition: "opacity 0.2s, transform 0.2s",
                          zIndex: 10,
                        }}
                      >
                        Delete
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / New School Form */}
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
            {editing.id ? "Edit School" : "New School"}
          </h3>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <input
              placeholder="Name"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <input
              placeholder="Email"
              value={editing.email}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <input
              placeholder="Phone"
              value={editing.phone}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <input
              placeholder="Address"
              value={editing.address}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
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
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1a5fcc")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2c7be5")}
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
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f1f1f1")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
