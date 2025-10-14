import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSession } from "../session";
import { setAuth } from "../api";
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
} from "react-icons/fa";
import { useState, useRef, useEffect } from "react";
import "../sidebar.css";

export default function AuthedLayout() {
  const { me, loading } = useSession();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);

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
                <FaChalkboardTeacher />
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
                width: 200,
                background: "#fff",
                
                borderRadius: 8,
                boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
                overflow: "hidden",
                maxHeight: menuOpen ? 200 : 0,
                transition: "max-height 0.3s ease-in-out",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: menuOpen ? "12px" : "0 12px",
                  opacity: menuOpen ? 1 : 0,
                  transition: "opacity 0.3s ease-in-out, padding 0.3s ease-in-out",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{me.username}</div>
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
                  <FaEdit
                    style={{ cursor: "pointer", color: "#2c7be5" }}
                    title="Edit Profile"
                    onClick={() => console.log("Edit clicked")}
                  />
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
