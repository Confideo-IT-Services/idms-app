import { useEffect, useState } from "react";
import { api } from "../api";
import { useSession } from "../session";
import { FaEdit, FaTrash, FaPlus, FaArrowUp, FaArrowDown } from "react-icons/fa";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "textarea" | "select" | "file";
  required?: boolean;
  options?: string[];
  map_to?: string;
  unique?: boolean;
};

type Template = {
  id?: number;
  school?: number;
  name: string;
  fields: Field[];
};

type School = { id: number; name: string };

export default function FormTemplates() {
  const { me } = useSession();
  const [schools, setSchools] = useState<School[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const reqs: Promise<any>[] = [api.get("/form-templates/")];
    if (me?.role === "SUPER_ADMIN") reqs.push(api.get("/schools/"));
    const res = await Promise.all(reqs);
    const tRes = res[0];
    setTemplates(tRes.data.results ?? tRes.data);
    if (me?.role === "SUPER_ADMIN") {
      const sRes = res[1];
      setSchools(sRes.data.results ?? sRes.data);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [me?.role]);

  function newTemplate() {
    const base: Template = {
      name: "",
      fields: [
        { name: "full_name", label: "Student Name", type: "text", required: true, map_to: "full_name" },
        { name: "fatherName", label: "Father Name", type: "text" },
        { name: "address", label: "Address", type: "textarea" },
        { name: "blood_group", label: "Blood Group", type: "select", options: ["A+","A-","B+","B-","O+","O-","AB+","AB-"] },
        { name: "parent_phone", label: "Parent Phone", type: "tel", required: true, map_to: "parent_phone", unique: true },
        { name: "photo", label: "Photo", type: "file", required: true, map_to: "photo" }
      ]
    };
    if (me?.role === "SUPER_ADMIN" && schools.length) {
      (base as any).school = schools[0].id;
    }
    setEditing(base);
  }

  function updateField(idx: number, patch: Partial<Field>) {
    if (!editing) return;
    const fields = editing.fields.slice();
    fields[idx] = { ...fields[idx], ...patch };
    setEditing({ ...editing, fields });
  }

  function addField() {
    if (!editing) return;
    setEditing({
      ...editing,
      fields: [
        ...editing.fields,
        { name: `field_${editing.fields.length + 1}`, label: "New Field", type: "text" },
      ],
    });
  }

  function removeField(idx: number) {
    if (!editing) return;
    const fields = editing.fields.slice();
    fields.splice(idx, 1);
    setEditing({ ...editing, fields });
  }

  function move(idx: number, dir: -1 | 1) {
    if (!editing) return;
    const j = idx + dir;
    if (j < 0 || j >= editing.fields.length) return;
    const fields = editing.fields.slice();
    [fields[idx], fields[j]] = [fields[j], fields[idx]];
    setEditing({ ...editing, fields });
  }

  async function saveTemplate() {
    if (!editing) return;
    const payload: any = { name: editing.name, fields: editing.fields };
    if (me?.role === "SUPER_ADMIN") {
      if (!editing.school) { alert("Please choose a school"); return; }
      payload.school_id = editing.school;
    }
    if (editing.id) await api.put(`/form-templates/${editing.id}/`, payload);
    else await api.post(`/form-templates/`, payload);
    setEditing(null);
    await load();
  }

  async function deleteTemplate(id: number) {
    if (!confirm("Delete this template?")) return;
    await api.delete(`/form-templates/${id}/`);
    await load();
  }

  const schoolName = (id?: number) => schools.find((s) => s.id === id)?.name || "-";

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Top accent line */}
      <div style={{ height: 2, width: "100%", backgroundColor: "#2c7be5", marginTop: 30, borderRadius: 2 }} />

      {/* Header + New Template button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, marginTop: 45, marginBottom: 20, color: "#2c7be5", fontSize: "26px", fontWeight: "bold" }}>
          Form Templates
        </h2>
        <button
          onClick={newTemplate}
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
          <FaPlus /> New Template
        </button>
      </div>

      {loading && <div>Loading…</div>}

      {/* Templates Table */}
      {!editing && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f1f1", textAlign: "left" }}>
                <th style={{ padding: "10px 8px" }}>ID</th>
                <th style={{ padding: "10px 8px" }}>Name</th>
                <th style={{ padding: "10px 8px" }}>School</th>
                <th style={{ padding: "10px 8px" }}>#Fields</th>
                <th style={{ padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  style={{ borderBottom: "1px solid #eee", cursor: "default", transition: "background 0.2s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "10px 8px" }}>{t.id}</td>
                  <td style={{ padding: "10px 8px" }}>{t.name}</td>
                  <td style={{ padding: "10px 8px" }}>
                    {(t as any).school?.name ?? schoolName((t as any).school) ?? "-"}
                  </td>
                  <td style={{ padding: "10px 8px" }}>{t.fields?.length ?? 0}</td>
                  <td style={{ padding: "10px 8px", display: "flex", gap: 12 }}>
                    <div style={{ position: "relative", cursor: "pointer", color: "#2c7be5" }} onClick={() => setEditing(t)}>
                      <FaEdit size={18} />
                      <span className="tooltip">Edit</span>
                    </div>
                    <div style={{ position: "relative", cursor: "pointer", color: "#e46e7aff" }} onClick={() => deleteTemplate(t.id!)}>
                      <FaTrash size={18} />
                      <span className="tooltip">Delete</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / New Template Form */}
      {editing && (
        <div
          style={{
            border: "1px solid #ddd",
            padding: 20,
            borderRadius: 10,
            marginTop: 20,
            backgroundColor: "#f9f9f9",
            maxWidth: 800,
            boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginBottom: 16, fontSize: 20, fontWeight: "bold" }}>
            {editing.id ? "Edit Template" : "New Template"}
          </h3>

          {me?.role === "SUPER_ADMIN" && (
            <select
              value={(editing as any).school ?? ""}
              onChange={(e) => setEditing({ ...editing, school: Number(e.target.value) })}
              style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none", marginBottom: 12 }}
            >
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}

          <input
            placeholder="Template Name"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc", outline: "none", marginBottom: 12, width: "100%" }}
          />

          <h4>Fields</h4>
          <div style={{ display: "grid", gap: 10 }}>
            {editing.fields.map((f, idx) => (
              <div key={idx} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 8 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}>
                  <input placeholder="name" value={f.name} onChange={(e) => updateField(idx, { name: e.target.value })} style={{ padding: "6px", borderRadius: 6, border: "1px solid #ccc" }} />
                  <input placeholder="label" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} style={{ padding: "6px", borderRadius: 6, border: "1px solid #ccc" }} />
                  <select value={f.type} onChange={(e) => updateField(idx, { type: e.target.value as Field["type"] })} style={{ padding: "6px", borderRadius: 6, border: "1px solid #ccc" }}>
                    <option value="text">text</option>
                    <option value="email">email</option>
                    <option value="tel">tel</option>
                    <option value="date">date</option>
                    <option value="textarea">textarea</option>
                    <option value="select">select</option>
                    <option value="file">file</option>
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
                    required
                  </label>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => move(idx, -1)}><FaArrowUp /></button>
                    <button type="button" onClick={() => move(idx, +1)}><FaArrowDown /></button>
                    <button type="button" onClick={() => removeField(idx)}>Delete</button>
                  </div>
                </div>
                {f.type === "select" && <SelectOptionsEditor options={f.options || []} onChange={(opts) => updateField(idx, { options: opts })} />}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              onClick={addField}
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
              + Add Field
            </button>
            <button
              onClick={saveTemplate}
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

      <style>
        {`
          td div:hover .tooltip {
            opacity: 1 !important;
            visibility: visible !important;
          }
          .tooltip {
            position: absolute;
            bottom: 125%;
            left: 50%;
            transform: translateX(-50%);
            background-color: #333;
            color: #fff;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s;
            pointer-events: none;
          }
        `}
      </style>
    </div>
  );
}

function SelectOptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [text, setText] = useState(options.join("\n"));
  useEffect(() => { setText(options.join("\n")); }, [options]);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Select options (one per line)</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onChange(text.split("\n").map(s => s.trim()).filter(Boolean))}
        rows={4}
        style={{ width: "100%", padding: "6px", borderRadius: 6, border: "1px solid #ccc" }}
      />
    </div>
  );
}
