// frontend/src/layouts/AuthedLayout.tsx
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../session";
import { setAuth, changePassword } from "../api";
import {
  FaTachometerAlt,
  FaSchool,
  FaUserTie,
  FaListUl,
  FaIdBadge,
  FaFileAlt,
  FaChalkboardTeacher,
  FaUserCircle,
  FaEdit,
  FaChevronLeft,
  FaChevronRight,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";
import { useState, useRef, useEffect } from "react";
import "../sidebar.css";
import { FaFileArrowDown } from "react-icons/fa6";

export default function AuthedLayout() {
  const { me, loading } = useSession();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);

  // Password edit form state
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Visibility toggles for each password field
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (loading) return <div style={{ padding: 20 }}>Loading…</div>;
  if (!me) {
    nav("/login");
    return null;
  }

  function logout() {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setAuth(null);
    location.replace("/login");
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  async function submitChangePassword(e?: React.FormEvent) {
    e?.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (!currentPassword) {
      setPwError("Please provide your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setPwError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }

    try {
      setPwLoading(true);
      await changePassword(currentPassword, newPassword);
      setPwSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      // close editing after a brief pause
      setTimeout(() => {
        setEditing(false);
        setMenuOpen(false);
        setPwSuccess(null);
      }, 1200);
    } catch (err: any) {
      // Friendly parsing of various error shapes (string, JSON, axios response, HTML)
      let friendly = "Failed to change password.";
      try {
        // If Error with message that is JSON string
        if (err?.message) {
          // try parse JSON message
          try {
            const parsed = JSON.parse(err.message);
            if (parsed && typeof parsed === "object") {
              if (parsed.detail) friendly = String(parsed.detail);
              else {
                // join field errors
                const parts: string[] = [];
                for (const k of Object.keys(parsed)) {
                  const v = parsed[k];
                  if (Array.isArray(v)) parts.push(`${k}: ${v.join(" ")}`);
                  else parts.push(`${k}: ${String(v)}`);
                }
                if (parts.length) friendly = parts.join(" | ");
                else friendly = JSON.stringify(parsed);
              }
            } else {
              friendly = String(parsed);
            }
          } catch {
            // not JSON — use as plain string for now
            friendly = String(err.message);
          }
        } else if (err?.response) {
          // axios-style error with response
          const r = err.response;
          const ct = (r.headers && r.headers["content-type"]) || "";
          // HTML response -> user-friendly message
          if (typeof ct === "string" && ct.includes("text/html")) {
            friendly = `Server returned ${r.status} ${r.statusText}. The password-change endpoint was not found on the backend.`;
          } else if (r.data) {
            // JSON response body
            if (typeof r.data === "string") {
              friendly = r.data;
            } else if (typeof r.data === "object") {
              if (r.data.detail) friendly = String(r.data.detail);
              else {
                const parts: string[] = [];
                for (const k of Object.keys(r.data)) {
                  const v = r.data[k];
                  if (Array.isArray(v)) parts.push(`${k}: ${v.join(" ")}`);
                  else parts.push(`${k}: ${String(v)}`);
                }
                if (parts.length) friendly = parts.join(" | ");
                else friendly = JSON.stringify(r.data);
              }
            }
          } else {
            friendly = `Server returned ${r.status} ${r.statusText}`;
          }
        } else {
          // fallback network error
          friendly = err?.message || friendly;
        }
      } catch (parseErr) {
        // Ensure we always have a string
        friendly = err?.message || "Failed to change password.";
      }

      // Do not display raw HTML (in case friendly still contains tags)
      if (/<!doctype|<html|<body/i.test(friendly)) {
        friendly = "Server returned an HTML error page (likely endpoint missing). Check backend routes.";
      }

      setPwError(friendly);
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Sidebar + Main */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: expanded ? "220px 1fr" : "80px 1fr",
          flex: 1,
          transition: "grid-template-columns 0.3s ease",
        }}
      >
        {/* ---------- Sidebar ---------- */}
        <aside className={`sidebar ${expanded ? "expanded" : ""}`}>
          <h3 className="sidebar-title">IDMS</h3>

          {/* Sidebar Menu */}
          {me.role === "SUPER_ADMIN" ? (
            <nav className="sidebar-menu">
              <NavLink to="/admin/dashboard">
                <FaTachometerAlt />
                {expanded && <span>Dashboard</span>}
              </NavLink>
              <NavLink to="/admin/schools">
                <FaSchool />
                {expanded && <span>Schools</span>}
              </NavLink>
              <NavLink to="/admin/users">
                <FaUserTie />
                {expanded && <span>School Admins</span>}
              </NavLink>
              <NavLink to="/templates">
                <FaListUl />
                {expanded && <span>Templates</span>}
              </NavLink>
              <NavLink to="/admin/id-templates">
                <FaIdBadge />
                {expanded && <span>ID Templates</span>}
              </NavLink>
              <NavLink to="/admin/submissions">
                <FaFileAlt />
                {expanded && <span>Submissions</span>}
              </NavLink>
            </nav>
          ) : (
            <nav className="sidebar-menu">
              <NavLink to="/school/dashboard">
                <FaTachometerAlt />
                {expanded && <span>Dashboard</span>}
              </NavLink>
              <NavLink to="/school/classes">
                <FaChalkboardTeacher />
                {expanded && <span>Classes</span>}
              </NavLink>
              <NavLink to="/school/upload-links">
                <FaListUl />
                {expanded && <span>Upload Links</span>}
              </NavLink>
              <NavLink to="/school/submissions">
                <FaFileAlt />
                {expanded && <span>Submissions</span>}
              </NavLink>
            </nav>
          )}

          {/* Collapse Toggle Button */}
          <button
            className="sidebar-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <FaChevronLeft /> : <FaChevronRight />}
          </button>
        </aside>

        {/* ---------- Main Content ---------- */}
        <main style={{ padding: 16, position: "relative" }}>
          {/* Profile */}
          <div
            ref={menuRef}
            style={{
              position: "absolute",
              top: 24,
              right: 32,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              zIndex: 1000,
            }}
          >
            <FaUserCircle
              style={{
                fontSize: 28,
                cursor: "pointer",
                color: "#2c7be5",
                transition: "color 0.2s",
                borderRadius: "50%",
              }}
              onClick={() => setMenuOpen(!menuOpen)}
            />

            <div
              style={{
                marginTop: 8,
                width: 280,
                background: "#fff",
                borderRadius: 8,
                boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
                overflow: "hidden",
                maxHeight: menuOpen ? 420 : 0,
                transition: "max-height 0.3s ease-in-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  padding: menuOpen ? "12px" : "0 12px",
                  opacity: menuOpen ? 1 : 0,
                  transition: "opacity 0.3s ease-in-out, padding 0.3s ease-in-out",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{display:'flex', gap:8, alignItems:'center'}}>
                    <div style={{fontSize:14}}>{me.username}</div>
                  </div>

                  <FaEdit
                    style={{ cursor: "pointer", color: "#2c7be5" }}
                    title="Edit Profile"
                    onClick={() => {
                      setEditing(!editing);
                      setPwError(null);
                      setPwSuccess(null);
                    }}
                  />
                </div>

                {/* If editing is true show change-password form */}
                {editing ? (
                  <form onSubmit={submitChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ fontSize: 13, color: '#444' }}>
                      Username (read-only)
                      <input
                        type="text"
                        value={me.username}
                        readOnly
                        style={{ width: '100%', marginTop: 4, padding: '8px', borderRadius: 4, border: '1px solid #ddd', background:'#f7f7f7' }}
                      />
                    </label>

                    <label style={{ fontSize: 13, color: '#444', position: 'relative' }}>
                      Current password
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <input
                          type={showCurrent ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ddd' }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent((s) => !s)}
                          aria-label={showCurrent ? "Hide current password" : "Show current password"}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {showCurrent ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </label>

                    <label style={{ fontSize: 13, color: '#444', position: 'relative' }}>
                      New password
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <input
                          type={showNew ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ddd' }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew((s) => !s)}
                          aria-label={showNew ? "Hide new password" : "Show new password"}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {showNew ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </label>

                    <label style={{ fontSize: 13, color: '#444', position: 'relative' }}>
                      Confirm new password
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <input
                          type={showConfirm ? "text" : "password"}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ddd' }}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm((s) => !s)}
                          aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            padding: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {showConfirm ? <FaEyeSlash /> : <FaEye />}
                        </button>
                      </div>
                    </label>

                    {pwError && <div style={{ color: 'crimson', fontSize: 13 }}>{pwError}</div>}
                    {pwSuccess && <div style={{ color: 'green', fontSize: 13 }}>{pwSuccess}</div>}

                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button
                        type="submit"
                        disabled={pwLoading}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          border: 'none',
                          borderRadius: 4,
                          backgroundColor: '#2c7be5',
                          color: '#fff',
                          cursor: "pointer",
                          fontWeight: 500,
                        }}
                      >
                        {pwLoading ? 'Saving…' : 'Save password'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmNewPassword('');
                          setPwError(null);
                          setPwSuccess(null);
                        }}
                        style={{
                          padding: '8px 10px',
                          border: '1px solid #ccc',
                          borderRadius: 4,
                          background: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  // not editing: simple profile + logout button
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 12,
                        fontSize: 14,
                        color: "#333",
                        textTransform: "capitalize",
                      }}
                    >
                      <span>
                        {me.role === "SUPER_ADMIN"
                          ? "Super Admin"
                          : me.role === "SCHOOL_ADMIN"
                          ? "School Admin"
                          : me.role.toLowerCase()}
                      </span>
                    </div>
                    <button
                      onClick={logout}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        border: "none",
                        borderRadius: 4,
                        backgroundColor: "#2c7be5",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 500,
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#1a5fd1")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "#2c7be5")
                      }
                    >
                      Log Out
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <Outlet />
        </main>
      </div>

      {/* ---------- Footer ---------- */}
      <footer className="footer">
        Powered by <a href="#">ConfideoIT Services</a> | © {new Date().getFullYear()} ConfideoIT Services
      </footer>
    </div>
  );
}
