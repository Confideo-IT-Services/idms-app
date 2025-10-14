import { useEffect, useState } from "react";
import { api } from "../api";
import { FaEdit, FaTrash, FaUndo, FaPlus } from "react-icons/fa";

type School = { id: number; name: string };
type User = {
  id?: number;
  username: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role: "SCHOOL_ADMIN";
  school: number;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [u, s] = await Promise.all([api.get("/users/"), api.get("/schools/")]);
      setUsers(u.data.results ?? u.data);
      setSchools(s.data.results ?? s.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function newUser() {
    setEditing({
      username: "",
      password: "",
      first_name: "",
      last_name: "",
      email: "",
      role: "SCHOOL_ADMIN",
      school: schools[0]?.id || 0,
    });
  }

  async function save() {
    if (!editing) return;
    try {
      const payload = { ...editing };
      if (!payload.password) delete payload.password;
      if (editing.id) await api.put(`/users/${editing.id}/`, payload);
      else await api.post(`/users/`, payload);
      setEditing(null);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Save failed");
    }
  }

  async function resetPassword(id: number) {
    const pwd = prompt("Enter new password");
    if (!pwd) return;
    await api.post(`/users/${id}/reset_password/`, { password: pwd });
    alert("Password updated");
  }

  async function remove(id: number) {
    if (!confirm("Delete this user?")) return;
    await api.delete(`/users/${id}/`);
    await load();
  }

  const schoolName = (id?: number) => schools.find((s) => s.id === id)?.name || id;

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Full-width top line */}
      <div
        style={{
          height: 2,
          width: "100%",
          backgroundColor: "#2c7be5",
          marginTop: 30,
          borderRadius: 2,
        }}
      ></div>

      {/* Header + New User button */}
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
          School Admins
        </h2>
        <button
          onClick={newUser}
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
          <FaPlus /> New School Admin
        </button>
      </div>

      {/* Loading / Error */}
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      {/* User Table */}
      {!loading && !editing && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f1f1", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>ID</th>
                <th style={{ padding: "10px 8px" }}>Username</th>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>Email</th>
                <th style={{ padding: "10px 8px" }}>School</th>
                <th style={{ padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: "1px solid #eee",
                    cursor: "default",
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "10px 8px" }}>{u.id}</td>
                  <td style={{ padding: "10px 8px" }}>{u.username}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{u.email}</td>
                  <td style={{ padding: "10px 8px" }}>{schoolName(u.school)}</td>
                  <td style={{ padding: "10px 8px", display: "flex", gap: 12 }}>
                    {/* Edit */}
                    <div
                      style={{ position: "relative", cursor: "pointer", color: "#2c7be5" }}
                      onClick={() => setEditing(u)}
                    >
                      <FaEdit size={18} />
                      <span className="tooltip" style={{
                        position: "absolute",
                        bottom: "125%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "#333",
                        color: "#fff",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        opacity: 0,
                        visibility: "hidden",
                        transition: "opacity 0.2s",
                        pointerEvents: "none",
                      }}>Edit</span>
                    </div>

                    {/* Reset Password */}
                    <div
                      style={{ position: "relative", cursor: "pointer", color: "#f0ad4e" }}
                      onClick={() => resetPassword(u.id!)}
                    >
                      <FaUndo size={18} />
                      <span className="tooltip" style={{
                        position: "absolute",
                        bottom: "125%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "#333",
                        color: "#fff",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        opacity: 0,
                        visibility: "hidden",
                        transition: "opacity 0.2s",
                        pointerEvents: "none",
                      }}>Reset Password</span>
                    </div>

                    {/* Delete */}
                    <div
                      style={{ position: "relative", cursor: "pointer", color: "#e46e7aff" }}
                      onClick={() => remove(u.id!)}
                    >
                      <FaTrash size={18} />
                      <span className="tooltip" style={{
                        position: "absolute",
                        bottom: "125%",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "#333",
                        color: "#fff",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 12,
                        whiteSpace: "nowrap",
                        opacity: 0,
                        visibility: "hidden",
                        transition: "opacity 0.2s",
                        pointerEvents: "none",
                      }}>Delete</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / New User Form */}
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
            {editing.id ? "Edit School Admin" : "New School Admin"}
          </h3>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
            <input
              placeholder="Username"
              value={editing.username}
              onChange={(e) => setEditing({ ...editing, username: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <input
              placeholder="Password"
              type="password"
              value={editing.password || ""}
              onChange={(e) => setEditing({ ...editing, password: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <input
              placeholder="First Name"
              value={editing.first_name || ""}
              onChange={(e) => setEditing({ ...editing, first_name: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <input
              placeholder="Last Name"
              value={editing.last_name || ""}
              onChange={(e) => setEditing({ ...editing, last_name: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <input
              placeholder="Email"
              value={editing.email || ""}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            />
            <select
              value={editing.school}
              onChange={(e) => setEditing({ ...editing, school: Number(e.target.value) })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none" }}
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              value={editing.role}
              disabled
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                backgroundColor: "#f1f1f1",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
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

      {/* Tooltip CSS */}
      <style>
        {`
          td div:hover .tooltip {
            opacity: 1 !important;
            visibility: visible !important;
          }
        `}
      </style>
    </div>
  );
}
