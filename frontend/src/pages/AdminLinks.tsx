import { useEffect, useState } from "react";
import { api } from "../api";
import dayjs from "dayjs";
import { useSession } from "../session";
import {
  FaPlus,
  FaFileAlt,
  FaPlay,
  FaPause,
  FaSync,
  FaClock,
  FaTrash,
  FaBroom,
} from "react-icons/fa";

type UploadLink = {
  id: number;
  token: string;
  school: number;
  classroom: number;
  template?: number;
  expires_at: string;
  is_active: boolean;
  notes: string;
  max_uses: number | null;
  uses_count: number;
};

type School = { id: number; name: string };
type ClassRoom = { id: number; class_name: string; section?: string | null };
type Template = { id: number; name: string };

export default function AdminLinks() {
  const [links, setLinks] = useState<UploadLink[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const { me } = useSession();
  const [form, setForm] = useState({
    school: 0,
    classroom: 0,
    template: 0,
    notes: "",
    days: 14,
    max_uses: "",
  });

  async function loadAll() {
    const reqs = [
      api.get("/upload-links/"),
      api.get("/classes/"),
      api.get("/form-templates/"),
    ];
    if (me?.role === "SUPER_ADMIN") reqs.splice(1, 0, api.get("/schools/"));

    const res = await Promise.all(reqs);
    const [l, maybeSchools, c, t] =
      me?.role === "SUPER_ADMIN"
        ? res
        : [res[0], null, res[1], res[2]];

    setLinks(l.data);
    if (maybeSchools) setSchools(maybeSchools.data.results ?? maybeSchools.data);
    setClasses(c.data.results ?? c.data);
    setTemplates(t.data.results ?? t.data);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function createLink(e: React.FormEvent) {
    e.preventDefault();
    const expires_at = dayjs().add(Number(form.days || 14), "day").toISOString();
    const schoolId = me?.role === "SCHOOL_ADMIN" ? me.school_id : Number(form.school);
    const tmplId = form.template ? Number(form.template) : null;

    if (!tmplId) {
      alert("Please choose a template");
      return;
    }

    await api.post("/upload-links/", {
      school: schoolId,
      classroom: Number(form.classroom),
      template: tmplId,
      expires_at,
      is_active: true,
      notes: form.notes,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
    });

    await loadAll();
  }

  async function action(path: string) {
    await api.post(path);
    await loadAll();
  }

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Blue line header */}
      <div
        style={{
          height: 2,
          width: "100%",
          backgroundColor: "#2c7be5",
          marginTop: 30,
          borderRadius: 2,
        }}
      ></div>

      {/* Page title */}
      <h2
        style={{
          marginTop: 45,
          marginBottom: 25,
          color: "#2c7be5",
          fontSize: "26px",
          fontWeight: "bold",
        }}
      >
        Upload Links
      </h2>

      {/* Templates button above create */}
      {/* <div style={{ marginBottom: 10 }}>
        <a href="/templates" title="Templates">
          <button
            type="button"
            style={{ ...buttonStyle, backgroundColor: "#4db14d" }}
          >
            <FaFileAlt />
          </button>
        </a>
      </div> */}

      {/* Form row */}
      <form
        onSubmit={createLink}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 25,
        }}
      >
        {me?.role === "SUPER_ADMIN" && (
          <select
            name="school"
            value={form.school}
            onChange={onChange}
            required
            style={inputStyle}
            title="Select School"
          >
            <option value="">Select School</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        <select
          name="classroom"
          value={form.classroom}
          onChange={onChange}
          required
          style={inputStyle}
          title="Select Class"
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.class_name}
              {c.section ? ` - ${c.section}` : ""}
            </option>
          ))}
        </select>

        <select
          name="template"
          value={form.template}
          onChange={onChange}
          required
          style={inputStyle}
          title="Select Template"
        >
          <option value="">Select Template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <input
          name="days"
          type="number"
          min={1}
          placeholder="Days (14)"
          value={form.days}
          onChange={onChange}
          style={inputStyle}
          title="Days until expiry"
        />
        <input
          name="max_uses"
          placeholder="Max uses (optional)"
          value={form.max_uses}
          onChange={onChange}
          style={inputStyle}
          title="Max uses"
        />
        <input
          name="notes"
          placeholder="Notes"
          value={form.notes}
          onChange={onChange}
          style={{ ...inputStyle, minWidth: 180 }}
          title="Notes"
        />

        {/* Create Button next to Notes */}
        <button type="submit" style={buttonStyle} title="Create">
          <FaPlus />
        </button>
      </form>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 700,
            borderRadius: 6,
          }}
        >
          <thead>
            <tr style={{ backgroundColor: "#f1f1f1", textAlign: "left" }}>
              {[
                "ID",
                // "Token",
                "Share Link",
                "Active",
                "Expires",
                "Template",
                "Uses",
                "Actions",
              ].map((h) => (
                <th key={h} style={{ padding: "10px 8px" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  style={{ textAlign: "center", padding: "24px", color: "#777" }}
                >
                  No upload links found
                </td>
              </tr>
            ) : (
              links.map((l) => {
                const shareUrl = `${location.origin}/u/${l.token}`;
                return (
                  <tr
                    key={l.id}
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
                    <td style={tdStyle}>{l.id}</td>
                    {/* <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                      {l.token}
                    </td> */}
                    <td style={tdStyle}>
                      <a href={shareUrl} target="_blank" rel="noreferrer">
                        {shareUrl}
                      </a>
                    </td>
                    <td style={tdStyle}>{l.is_active ? "Yes" : "No"}</td>
                    <td style={tdStyle}>
                      {dayjs(l.expires_at).format("YYYY-MM-DD")}
                    </td>
                    <td style={tdStyle}>
                      {templates.find((t) => t.id === l.template)?.name ?? (
                        <i>None</i>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {l.uses_count}
                      {l.max_uses ? ` / ${l.max_uses}` : ""}
                    </td>
                    <td style={{ ...tdStyle, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {/* <button
                        onClick={() => action(`/api/upload-links/${l.id}/activate/`)}
                        style={smallButtonStyle}
                        title="Activate"
                      >
                        <FaPlay />
                      </button> */}

                      {/* <button
                        onClick={() => action(`/api/upload-links/${l.id}/deactivate/`)}
                        style={{
                          ...smallButtonStyle,
                          backgroundColor: "#dc3545",
                        }}
                        title="Deactivate"
                      >
                        <FaPause />
                      </button> */}

                      {/* <button
                        onClick={() => action(`/api/upload-links/${l.id}/extend/`)}
                        style={smallButtonStyle}
                        title="Extend +7 days"
                      >
                        <FaClock />
                      </button> */}

                      {/* <button
                        onClick={() => action(`/api/upload-links/${l.id}/rotate_token/`)}
                        style={smallButtonStyle}
                        title="Rotate Token"
                      >
                        <FaSync />
                      </button> */}

                      <button
                        style={{ ...smallButtonStyle, backgroundColor: "#ff9800" }}
                        onClick={async () => {
                          if (confirm("Delete this link?")) {
                            await api.delete(`/upload-links/${l.id}/`);
                            setLinks(links.filter((x) => x.id !== l.id));
                          }
                        }}
                        title="Delete"
                      >
                        <FaTrash />
                      </button>

                      <button
                        style={{ ...smallButtonStyle, backgroundColor: "#6c757d" }}
                        onClick={async () => {
                          if (confirm("Delete all expired links?")) {
                            const res = await api.delete("/upload-links/cleanup/");
                            alert(`Deleted ${res.data.deleted} expired links`);
                            await loadAll();
                          }
                        }}
                        title="Cleanup Expired"
                      >
                        <FaBroom />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 15,
  outline: "none",
  minWidth: 150,
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "none",
  backgroundColor: "#2c7be5",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 500,
  transition: "all 0.2s",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
};

const smallButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: "6px 10px",
  fontSize: 14,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
};
