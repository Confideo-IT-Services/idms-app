// frontend/src/pages/FormTemplates.tsx
import { useEffect, useState } from "react";
import { api } from "../api";
import { useSession } from "../session";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "textarea" | "select" | "file";
  required?: boolean;
  options?: string[];
};

type Template = {
  id?: number;
  school?: number;     // only sent by SUPER_ADMIN
  name: string;
  fields: Field[];
};

type School = { id: number; name: string };

export default function FormTemplates() {
  const { me } = useSession();
  const [schools, setSchools] = useState<School[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editing, setEditing] = useState<Template | null>(null);

  async function load() {
    const reqs: Promise<any>[] = [api.get("/form-templates/")];
    if (me?.role === "SUPER_ADMIN") reqs.push(api.get("/schools/"));
    const res = await Promise.all(reqs);
    const tRes = res[0];
    setTemplates(tRes.data.results ?? tRes.data);
    if (me?.role === "SUPER_ADMIN") {
      const sRes = res[1];
      setSchools(sRes.data.results ?? sRes.data);
    }
  }

  useEffect(() => { load(); }, [me?.role]);

  function newTemplate() {
    // do NOT set school=0; leave undefined for School Admin (server attaches)
    // For Super Admin, we can preselect the first school to avoid empty submit.
    const base: Template = {
      name: "",
      // fields: [
      //   { name: "full_name", label: "Student Name", type: "text", required: true },
      //   { name: "parent_phone", label: "Parent Phone", type: "tel", required: true },
      //   { name: "photo", label: "Photo", type: "file", required: true },
      //   { name: "fatherName", label: "Father Name", type: "text", required: false }
      // ],
      fields: [
        {name:"full_name", label:"Student Name",type:"text",required:true, map_to:"full_name"},
        {name:"fatherName",label:"Father Name",type:"text",required:false},
        {name:"address",label:"Address",type:"textarea",required:false},
        {name:"blood_group",label:"Blood Group",type:"select",options:["A+","A-","B+","B-","O+","O-","AB+","AB-"],required:false},
        {name:"parent_phone",label:"Parent Phone",type:"tel",required:true, map_to:"parent_phone","unique":true},
        {name:"photo",label:"Photo",type:"file",required:true, map_to:"photo"}
    ],
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
        { name: `field_${editing.fields.length + 1}`, label: "New Field", type: "text", required: false },
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
    const fields = editing.fields.slice();
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[idx], fields[j]] = [fields[j], fields[idx]];
    setEditing({ ...editing, fields });
  }

  async function saveTemplate() {
    if (!editing) return;
    // Build payload: for School Admin do NOT send school; for Super Admin send school (required)
    const payload: any = {
      name: editing.name,
      fields: editing.fields,
    };
    if (me?.role === "SUPER_ADMIN") {
      if (!editing.school) {
        alert("Please choose a school");
        return;
      }
      payload.school_id = editing.school; // our serializer expects school_id for write
    }

    if (editing.id) {
      await api.put(`/form-templates/${editing.id}/`, payload);
    } else {
      await api.post(`/form-templates/`, payload);
    }
    setEditing(null);
    await load();
  }

  async function deleteTemplate(id: number) {
    if (!confirm("Delete this template?")) return;
    await api.delete(`/form-templates/${id}/`);
    await load();
  }

  return (
    <div style={{ maxWidth: 1000, margin: "2rem auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Form Templates</h2>
        <button onClick={newTemplate}>+ New Template</button>
      </div>

      {!editing && (
        <table className="table" style={{ width: "100%", marginTop: 16 }}>
          <thead>
            <tr><th>ID</th><th>Name</th><th>School</th><th>#Fields</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.name}</td>
                <td>
                  {/* backend returns read-only school object inside .school (if your serializer shows it).
                      If not, you can keep just the id or show "-" */}
                  {/* @ts-ignore */}
                  { (t as any).school?.name ?? "-" }
                </td>
                <td>{t.fields?.length ?? 0}</td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditing(t)}>Edit</button>
                  <button onClick={() => deleteTemplate(t.id!)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div style={{ marginTop: 20, border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <h3>{editing.id ? "Edit Template" : "New Template"}</h3>

          {/* Only SUPER_ADMIN picks school */}
          {me?.role === "SUPER_ADMIN" && (
            <div style={{ marginBottom: 8 }}>
              <label>School&nbsp;</label>
              <select
                value={(editing as any).school ?? ""}
                onChange={e => setEditing({ ...editing, school: Number(e.target.value) })}
              >
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <label>Template Name&nbsp;</label>
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          </div>

          <h4>Fields</h4>
          <div style={{ display: "grid", gap: 10 }}>
            {editing.fields.map((f, idx) => (
              <div key={idx} style={{ border: "1px solid #ddd", padding: 10, borderRadius: 8 }}>
                <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr 1fr auto" }}>
                  <input placeholder="name" value={f.name} onChange={e => updateField(idx, { name: e.target.value })} />
                  <input placeholder="label" value={f.label} onChange={e => updateField(idx, { label: e.target.value })} />
                  <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as Field["type"] })}>
                    <option value="text">text</option>
                    <option value="email">email</option>
                    <option value="tel">tel</option>
                    <option value="date">date</option>
                    <option value="textarea">textarea</option>
                    <option value="select">select</option>
                    <option value="file">file</option>
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={!!f.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                    required
                  </label>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" onClick={() => move(idx, -1)}>↑</button>
                    <button type="button" onClick={() => move(idx, +1)}>↓</button>
                    <button type="button" onClick={() => removeField(idx)}>Delete</button>
                  </div>
                </div>
                {f.type === "select" && <SelectOptionsEditor options={f.options || []} onChange={(opts) => updateField(idx, { options: opts })} />}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={addField}>+ Add Field</button>
            <button onClick={saveTemplate}>Save</button>
            <button onClick={() => setEditing(null)}>Close</button>
          </div>
        </div>
      )}
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
        style={{ width: "100%" }}
      />
    </div>
  );
}