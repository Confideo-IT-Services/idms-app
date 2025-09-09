// frontend/src/pages/AdminIdTemplates.tsx
import React, { useEffect, useMemo, useState } from "react"
import { Rnd } from "react-rnd"
import { api } from "../api"

/**
 * AdminIdTemplates.tsx
 * - Pick School -> pick existing Template (or create new)
 * - Shows background preview (and let you upload/replace it)
 * - Shows fields defined in the selected template's `fields` JSON
 * - Drag & resize placeholders (auto font preview)
 * - Save Layout (PATCH) updates the selected template
 * - Create New Template (POST)
 *
 * Notes:
 * - Make sure backend id-templates endpoints accept multipart/form-data for create/update
 * - Make sure template serializer exposes `fields` and writable `background` and `is_default`
 */

type Element = {
  id: number
  name: string
  x: number
  y: number
  width: number
  height: number
  font?: string
  size?: number
  color?: string
  isImage?: boolean
}

export default function AdminIdTemplates() {
  const [schools, setSchools] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [schoolId, setSchoolId] = useState<number | "">("")
  const [templateId, setTemplateId] = useState<number | "">("")
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)

  // designer state
  const [elements, setElements] = useState<Element[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // local new data (for create)
  const [newName, setNewName] = useState("")
  const [bgFile, setBgFile] = useState<File | null>(null)
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string>("")
  const [isDefault, setIsDefault] = useState(false)

  // load schools on mount
  useEffect(() => {
    api.get("/schools/").then(res => {
      setSchools(res.data.results ?? res.data)
    })
  }, [])

  // when school changes, fetch templates
  useEffect(() => {
    async function loadTemplates() {
      if (!schoolId) {
        setTemplates([])
        setTemplateId("")
        setSelectedTemplate(null)
        return
      }
      const res = await api.get(`/id-templates/?school=${schoolId}`)
      const data = res.data.results ?? res.data
      setTemplates(data)
      // if there's a default template, preselect it
      const def = data.find((t:any) => t.is_default)
      if (def) {
        setTemplateId(def.id)
      } else {
        setTemplateId(data.length ? data[0].id : "")
      }
    }
    loadTemplates()
  }, [schoolId])

  // when templateId changes, set selectedTemplate and load its fields/background into designer
  useEffect(() => {
    if (!templateId) {
      setSelectedTemplate(null)
      setElements([])
      setBgPreviewUrl("")
      setIsDefault(false)
      return
    }
    const tpl = templates.find((t:any) => Number(t.id) === Number(templateId)) ?? null
    setSelectedTemplate(tpl)
    setIsDefault(!!tpl?.is_default)

    // set background preview if present (the backend should provide .background as URL)
    setBgPreviewUrl(tpl?.background ?? "")

    // set initial elements from the template.fields positions if present
    const fieldsObj = tpl?.fields ?? {}
    const elems: Element[] = []
    Object.keys(fieldsObj).forEach((k,i) => {
      const cfg = fieldsObj[k] || {}
      elems.push({
        id: Date.now() + i,
        name: k,
        x: Math.round(cfg.x ?? 20),
        y: Math.round(cfg.y ?? 20),
        width: Math.round(cfg.width ?? (cfg.w ?? (cfg.isImage ? 120 : 150))),
        height: Math.round(cfg.height ?? (cfg.h ?? (cfg.isImage ? 150 : 40))),
        font: cfg.font ?? "arial.ttf",
        size: cfg.size ?? Math.round((cfg.height ?? 40) * 0.45),
        color: cfg.color ?? "#000000",
        isImage: !!cfg.isImage || k === "photo",
      })
    })
    setElements(elems)
  }, [templateId, templates])

  // cleanup objectURL on bgFile change/unmount
  useEffect(() => {
    return () => {
      if (bgPreviewUrl && bgPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(bgPreviewUrl)
      }
    }
  }, [bgPreviewUrl])

  // helper: available fields come from selectedTemplate.fields keys
  const availableFields = useMemo(() => {
    if (!selectedTemplate) return []
    return Object.keys(selectedTemplate.fields ?? {})
  }, [selectedTemplate])

  // add one placeholder element (when user clicks Add)
  function addField(fieldName: string) {
    const isImage = fieldName === "photo" || !!selectedTemplate?.fields?.[fieldName]?.isImage
    const el: Element = {
      id: Date.now() + Math.floor(Math.random() * 999),
      name: fieldName,
      x: 20,
      y: 20,
      width: isImage ? 120 : 160,
      height: isImage ? 160 : 40,
      font: "arial.ttf",
      size: isImage ? 12 : 16,
      color: "#000000",
      isImage,
    }
    setElements((s) => [...s, el])
    setSelectedId(el.id)
  }

  function updateElement(id:number, patch: Partial<Element>) {
    setElements(s => s.map(el => el.id === id ? { ...el, ...patch } : el))
  }
  function removeElement(id:number) {
    setElements(s => s.filter(e => e.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function onBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setBgFile(f)
    if (f) {
      const url = URL.createObjectURL(f)
      setBgPreviewUrl(url)
    }
  }

  // Save changes TO THE SELECTED TEMPLATE (PATCH)
  async function saveLayoutToTemplate() {
    if (!selectedTemplate) { alert("Select a template first"); return }
    // build mapping JSON from elements
    const fieldsMap: Record<string, any> = {}
    elements.forEach(el => {
      fieldsMap[el.name] = {
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
        font: el.font ?? "arial.ttf",
        size: Math.round(el.size ?? Math.round(el.height * 0.45)),
        color: el.color ?? "#000000",
        isImage: !!el.isImage,
      }
    })

    const form = new FormData()
    form.append("fields", JSON.stringify(fieldsMap))
    form.append("is_default", String(isDefault))
    // only append background file if admin uploaded a new file (replace)
    if (bgFile) form.append("background", bgFile)

    try {
      // PATCH the selected template
      await api.patch(`/id-templates/${selectedTemplate.id}/`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      })
      // re-fetch templates for the school to get updated list and URLs
      await refreshTemplatesForSchool()
      alert("Template updated")
    } catch (err:any) {
      alert("Failed to save layout: " + (err?.response?.data ? JSON.stringify(err.response.data) : err.message))
    }
  }

  // Create new template (POST)
  async function createNewTemplate() {
    if (!schoolId) { alert("Select a school first"); return }
    if (!newName) { alert("Provide a name"); return }
    if (!bgFile) { alert("Upload a background image"); return }

    const fieldsMap: Record<string, any> = {}
    elements.forEach(el => {
      fieldsMap[el.name] = {
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
        font: el.font ?? "arial.ttf",
        size: Math.round(el.size ?? Math.round(el.height * 0.45)),
        color: el.color ?? "#000000",
        isImage: !!el.isImage,
      }
    })

    const form = new FormData()
    form.append("school", String(schoolId))
    form.append("name", newName)
    form.append("fields", JSON.stringify(fieldsMap))
    form.append("is_default", String(isDefault))
    form.append("background", bgFile)

    try {
      await api.post(`/id-templates/`, form, { headers: { "Content-Type": "multipart/form-data" } })
      // refresh templates
      await refreshTemplatesForSchool()
      setNewName("")
      setBgFile(null)
      setBgPreviewUrl("")
      setElements([])
      alert("Template created")
    } catch (err:any) {
      alert("Failed to create template: " + (err?.response?.data ? JSON.stringify(err.response.data) : err.message))
    }
  }

  async function refreshTemplatesForSchool() {
    if (!schoolId) {
      setTemplates([])
      return
    }
    const res = await api.get(`/id-templates/?school=${schoolId}`)
    const data = res.data.results ?? res.data
    setTemplates(data)
    // try to reselect the template if currently selected
    if (selectedTemplate) {
      const still = data.find((t:any) => t.id === selectedTemplate.id)
      if (still) {
        setSelectedTemplate(still)
        setTemplateId(still.id)
        setBgPreviewUrl(still.background ?? "")
      } else {
        // if the selected template was deleted/changed, pick default or first
        const def = data.find((t:any) => t.is_default)
        if (def) {
          setTemplateId(def.id)
        } else {
          setTemplateId(data.length ? data[0].id : "")
        }
      }
    } else {
      // choose first or default
      const def = data.find((t:any) => t.is_default)
      if (def) setTemplateId(def.id)
    }
  }

  // load templates helper exposed to UI (manual refresh)
  async function onManualRefresh() {
    await refreshTemplatesForSchool()
  }

  // when templates change (external) try to keep selectedTemplate object up-to-date
  useEffect(() => {
    if (!templateId) return
    const t = templates.find((x:any) => Number(x.id) === Number(templateId))
    if (t) {
      setSelectedTemplate(t)
      setBgPreviewUrl(t.background ?? "")
      setIsDefault(!!t.is_default)
    }
  }, [templates, templateId])

  // small helper for preview font size based on box height
  function previewFontSize(el: Element) {
    return Math.max(8, Math.round((el.size ?? (el.height * 0.45))))
  }

  return (
    <div className="app-container">
      <div className="card">
        <h2>ID Template Designer (Super Admin)</h2>

        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <select value={schoolId as any} onChange={(e) => setSchoolId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">-- Select School --</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={templateId as any} onChange={(e) => setTemplateId(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">-- Select Template --</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name} {t.is_default ? " (default)" : ""}</option>)}
          </select>

          <button className="button secondary" onClick={onManualRefresh}>Refresh Templates</button>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ minWidth: 220 }}>
            <h4>Template Controls</h4>

            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Background (replace or upload for new templates)</label>
              <input type="file" accept="image/*" onChange={onBgFileChange} />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label className="form-label">Template name (for new)</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name for new template" />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} /> Set as default
              </label>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="button" onClick={createNewTemplate}>Create New Template</button>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="button secondary" onClick={saveLayoutToTemplate}>Save Layout to Selected Template</button>
            </div>

            <div style={{ marginTop: 18 }}>
              <h4>Available fields</h4>
              {availableFields.length === 0 && <div className="helper">Select a template to see its fields</div>}
              {(availableFields || []).map((f:string) => (
                <div key={f} style={{ marginBottom: 6 }}>
                  <button className="btn-small" onClick={() => addField(f)}>{f}</button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 18 }}>
              <h4>Selected element</h4>
              {selectedId ? (
                <>
                  {(() => {
                    const s = elements.find(e => e.id === selectedId)!
                    return (
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.name}</div>
                        <div style={{ marginTop: 8 }}>
                          <label className="form-label">Font family</label>
                          <select value={s.font} onChange={e => updateElement(s.id, { font: e.target.value })}>
                            <option value="arial.ttf">Arial</option>
                            <option value="arialbd.ttf">Arial Bold</option>
                            <option value="times.ttf">Times</option>
                          </select>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <label className="form-label">Font size</label>
                          <input type="number" value={s.size} onChange={e => updateElement(s.id, { size: Number(e.target.value) })} />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <label className="form-label">Color</label>
                          <input type="color" value={s.color} onChange={e => updateElement(s.id, { color: e.target.value })} />
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <button className="button secondary" onClick={() => removeElement(s.id)}>Remove</button>
                        </div>
                      </div>
                    )
                  })()}
                </>
              ) : <div>No element selected</div>}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ width: "100%", height: 900, border: "1px solid #ddd", position: "relative", overflow: "hidden", background: "#fff" }}>
              {bgPreviewUrl ? (
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${bgPreviewUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }}>
                  {elements.map(el => (
                    <Rnd
                      key={el.id}
                      bounds="parent"
                      size={{ width: el.width, height: el.height }}
                      position={{ x: el.x, y: el.y }}
                      onDragStop={(e, d) => updateElement(el.id, { x: Math.round(d.x), y: Math.round(d.y) })}
                      onResizeStop={(e, dir, ref, delta, pos) => updateElement(el.id, {
                        width: Math.round(ref.offsetWidth),
                        height: Math.round(ref.offsetHeight),
                        x: Math.round(pos.x),
                        y: Math.round(pos.y),
                      })}
                      onClick={() => setSelectedId(el.id)}
                      style={{
                        border: selectedId === el.id ? "2px solid #2196f3" : "1px dashed #c00",
                        background: el.isImage ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "move",
                        color: el.color ?? "#000"
                      }}
                    >
                      <div style={{
                        fontSize: previewFontSize(el),
                        fontFamily: el.font ?? "Arial",
                        width: "100%",
                        textAlign: "center",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}>
                        {el.isImage ? "PHOTO" : el.name}
                      </div>
                    </Rnd>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20 }}>Background not set. Upload background or select a template which already has one.</div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              Tip: click a placeholder to edit font, size, color. Use "Save Layout to Selected Template" to persist positions to the template you selected.
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // helper inline
  function previewFontSize(el: Element) {
    // prefer explicit size, else derive from height
    if (el.size) return Math.max(8, Math.round(el.size))
    return Math.max(8, Math.round(el.height * 0.45))
  }
}
