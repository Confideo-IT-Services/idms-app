// frontend/src/pages/AdminIdTemplates.tsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Rnd } from "react-rnd"
import { api } from "../api"
import { FaPlus } from "react-icons/fa"

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
  const previewWidth = 700
  const previewHeight = 900
  const previewRef = useRef<HTMLDivElement | null>(null)

  const [schools, setSchools] = useState<any[]>([])
  const [formTemplates, setFormTemplates] = useState<any[]>([])
  const [idTemplates, setIdTemplates] = useState<any[]>([])

  const [schoolId, setSchoolId] = useState<number | "">("")
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState<number | "">("")
  const [selectedIdTemplateId, setSelectedIdTemplateId] = useState<number | "">("")
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)

  const [bgFile, setBgFile] = useState<File | null>(null)
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string>("")
  const [bgNaturalW, setBgNaturalW] = useState<number>(0)
  const [bgNaturalH, setBgNaturalH] = useState<number>(0)
  const [elements, setElements] = useState<Element[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [newName, setNewName] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [cardSizeMM, setCardSizeMM] = useState<{ w: number; h: number }>({ w: 54, h: 86 })

  // load schools
  useEffect(() => {
    api
      .get("/schools/")
      .then(res => setSchools(res.data.results ?? res.data))
      .catch(() => setSchools([]))
  }, [])

  // when school changes, load form templates & id templates
  useEffect(() => {
    async function load() {
      if (!schoolId) {
        setFormTemplates([])
        setIdTemplates([])
        setSelectedFormTemplateId("")
        setSelectedIdTemplateId("")
        setSelectedTemplate(null)
        setBgPreviewUrl("")
        setElements([])
        return
      }
      try {
        const ft = await api.get(`/form-templates/?school=${schoolId}`)
        setFormTemplates(ft.data.results ?? ft.data)
      } catch (e) {
        setFormTemplates([])
      }
      try {
        const it = await api.get(`/id-templates/?school=${schoolId}`)
        const idData = it.data.results ?? it.data
        setIdTemplates(idData)
        if (idData.length) {
          const def = idData.find((t: any) => t.is_default) ?? idData[0]
          setSelectedIdTemplateId(def.id)
          setBgPreviewUrl(def.background_url ?? def.background ?? "")
          if (def.card_size_mm) setCardSizeMM(def.card_size_mm)
        }
      } catch (e) {
        setIdTemplates([])
      }
    }
    load()
  }, [schoolId])

  // when selected ID template changes
  useEffect(() => {
    const tpl =
      idTemplates.find(
        t => String(t.id) === String(selectedIdTemplateId) || t.id === selectedIdTemplateId
      ) ?? null
    setSelectedTemplate(tpl)
    if (!tpl) {
      setElements([])
      setBgPreviewUrl("")
      setBgNaturalW(0)
      setBgNaturalH(0)
      return
    }
    const url = tpl.background_url ?? tpl.background ?? ""
    setBgPreviewUrl(url)
    if (tpl.card_size_mm) setCardSizeMM(tpl.card_size_mm)

    if (url) {
      const img = new Image()
      img.onload = () => {
        const natW = img.naturalWidth
        const natH = img.naturalHeight
        setBgNaturalW(natW)
        setBgNaturalH(natH)
        const scale = Math.min(previewWidth / natW, previewHeight / natH)
        const fields = tpl.fields ?? {}
        const elems: Element[] = Object.keys(fields).map((k, i) => {
          const cfg = fields[k]
          const imageX = Number(cfg.x ?? 0),
            imageY = Number(cfg.y ?? 0)
          const imageW = Number(cfg.width ?? cfg.w ?? 100),
            imageH = Number(cfg.height ?? cfg.h ?? 30)
          const px = Math.round(imageX * scale),
            py = Math.round(imageY * scale)
          const pw = Math.round(imageW * scale),
            ph = Math.round(imageH * scale)
          return {
            id: Date.now() + i,
            name: k,
            x: px,
            y: py,
            width: pw,
            height: ph,
            font: cfg.font ?? "arial.ttf",
            size: cfg.size ?? Math.round(ph * 0.45),
            color: cfg.color ?? "#000000",
            isImage: !!cfg.isImage || k === "photo",
          }
        })
        setElements(elems)
      }
      img.onerror = () => {
        setBgNaturalW(0)
        setBgNaturalH(0)
        setElements([])
      }
      img.src = url
    } else {
      setBgNaturalW(0)
      setBgNaturalH(0)
      setElements([])
    }
  }, [selectedIdTemplateId, idTemplates])

  function onBgFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setBgFile(f)
    if (!f) {
      setBgPreviewUrl("")
      setBgNaturalW(0)
      setBgNaturalH(0)
      return
    }
    const url = URL.createObjectURL(f)
    setBgPreviewUrl(url)
    const img = new Image()
    img.onload = () => {
      setBgNaturalW(img.naturalWidth)
      setBgNaturalH(img.naturalHeight)
    }
    img.onerror = () => {
      setBgNaturalW(0)
      setBgNaturalH(0)
    }
    img.src = url
  }

  const availableFields = useMemo(() => {
    const ft =
      formTemplates.find(
        f => String(f.id) === String(selectedFormTemplateId) || f.id === selectedFormTemplateId
      ) ?? null
    if (!ft) return []
    const keys: any[] = []
    if (Array.isArray(ft.fields)) {
      for (const obj of ft.fields) {
        if (typeof obj === "string") keys.push(obj)
        else keys.push(obj.name ?? obj.label ?? JSON.stringify(obj))
      }
    } else if (typeof ft.fields === "object") {
      for (const k of Object.keys(ft.fields)) keys.push(k)
    }
    return keys
  }, [formTemplates, selectedFormTemplateId])

  function addField(fieldName: string) {
    const isImage = fieldName === "photo"
    const el: Element = {
      id: Date.now() + Math.floor(Math.random() * 1000),
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
    setElements(s => [...s, el])
    setSelectedId(el.id)
  }

  function updateElement(id: number, patch: Partial<Element>) {
    setElements(s => s.map(e => (e.id === id ? { ...e, ...patch } : e)))
  }

  function removeElement(id: number) {
    setElements(s => s.filter(e => e.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function convertPreviewToImageCoords(el: Element) {
    if (!bgNaturalW || !bgNaturalH) {
      return {
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
      }
    }
    const scale = Math.min(previewWidth / bgNaturalW, previewHeight / bgNaturalH)
    const imageX = Math.round(el.x / scale),
      imageY = Math.round(el.y / scale)
    const imageW = Math.round(el.width / scale),
      imageH = Math.round(el.height / scale)
    return { x: imageX, y: imageY, width: imageW, height: imageH }
  }

  async function saveLayoutToTemplate() {
    setStatusMsg(null)
    if (!selectedIdTemplateId) {
      setStatusMsg("No ID template selected")
      return
    }
    try {
      const fieldsMap: any = {}
      for (const el of elements) {
        const imgcoords = convertPreviewToImageCoords(el)
        fieldsMap[el.name] = {
          x: imgcoords.x,
          y: imgcoords.y,
          width: imgcoords.width,
          height: imgcoords.height,
          font: el.font,
          size: el.size ?? Math.round(el.height * 0.45),
          color: el.color,
          isImage: !!el.isImage,
        }
      }

      const form = new FormData()
      form.append("fields", JSON.stringify(fieldsMap))
      form.append("card_size_mm", JSON.stringify(cardSizeMM))
      form.append("is_default", String(isDefault))
      if (bgFile) form.append("background", bgFile)

      await api.patch(`/id-templates/${selectedIdTemplateId}/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      const refreshed = await api.get(`/id-templates/?school=${schoolId}`)
      setIdTemplates(refreshed.data.results ?? refreshed.data)
      setStatusMsg("Template updated")
    } catch (err: any) {
      setStatusMsg(
        "Failed to save: " +
          (err?.response?.data ? JSON.stringify(err.response.data) : err.message)
      )
    }
  }

  async function createNewTemplate() {
    setStatusMsg(null)
    if (!schoolId) {
      setStatusMsg("Select school")
      return
    }
    if (!newName) {
      setStatusMsg("Provide name")
      return
    }
    if (!bgFile) {
      setStatusMsg("Upload background")
      return
    }
    try {
      const fieldsMap: any = {}
      for (const el of elements) {
        const imgcoords = convertPreviewToImageCoords(el)
        fieldsMap[el.name] = {
          x: imgcoords.x,
          y: imgcoords.y,
          width: imgcoords.width,
          height: imgcoords.height,
          font: el.font,
          size: el.size ?? Math.round(el.height * 0.45),
          color: el.color,
          isImage: !!el.isImage,
        }
      }
      const form = new FormData()
      form.append("school", String(schoolId))
      form.append("name", newName)
      form.append("fields", JSON.stringify(fieldsMap))
      form.append("is_default", String(isDefault))
      form.append("background", bgFile)
      form.append("card_size_mm", JSON.stringify(cardSizeMM))
      await api.post(`/id-templates/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })

      const refreshed = await api.get(`/id-templates/?school=${schoolId}`)
      setIdTemplates(refreshed.data.results ?? refreshed.data)
      setBgFile(null)
      setBgPreviewUrl("")
      setElements([])
      setNewName("")
      setStatusMsg("Template created")
    } catch (err: any) {
      setStatusMsg(
        "Failed to create: " +
          (err?.response?.data ? JSON.stringify(err.response.data) : err.message)
      )
    }
  }

  function previewFontSize(el: Element) {
    return Math.max(8, Math.round(el.size ?? Math.round(el.height * 0.45)))
  }

  return (
    <div style={{ padding: 20, paddingLeft: 0, paddingRight: 0 }}>
      {/* Top accent line */}
      <div
        style={{
          height: 2,
          width: "100%",
          backgroundColor: "#2c7be5",
          marginTop: 30,
          borderRadius: 2,
        }}
      />

      {/* Main card */}
      <div
        style={{
          // border: "1px solid #ddd",
          padding: 20,
          borderRadius: 10,
          marginTop: 20,
          // backgroundColor: "#f9f9f9",
          // boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
        }}
      >
        <h2 style={{ marginBottom: 16, fontSize: 24, fontWeight: "bold", color: "#2c7be5", marginTop: 0 }}>
          ID Template Designer
        </h2>

        {statusMsg && (
          <div style={{ color: "#b00020", marginBottom: 12 }}>{statusMsg}</div>
        )}

        {/* Top selectors & controls */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <select
            value={schoolId as any}
            onChange={e =>
              setSchoolId(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">-- Select School --</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedFormTemplateId as any}
            onChange={e =>
              setSelectedFormTemplateId(
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">-- Parent Form Template --</option>
            {formTemplates.map((f: any) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <select
            value={selectedIdTemplateId as any}
            onChange={e =>
              setSelectedIdTemplateId(
                e.target.value === "" ? "" : Number(e.target.value)
              )
            }
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              outline: "none",
            }}
          >
            <option value="">-- ID Template --</option>
            {idTemplates.map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.is_default ? "(default)" : ""}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
            />
            Set default
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Card size:
            <select
              value={`${cardSizeMM.w}x${cardSizeMM.h}`}
              onChange={e => {
                const [w, h] = e.target.value.split("x").map(Number)
                setCardSizeMM({ w, h })
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                outline: "none",
              }}
            >
              <option value="54x86">54 x 86 mm</option>
              <option value="48x72">48 x 72 mm</option>
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 18 }}>
          {/* Left controls */}
          <div style={{ minWidth: 260 }}>
            <h4 style={{ marginBottom: 12 }}>Controls</h4>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Upload / Replace background</label>
              <input type="file" accept="image/*" onChange={onBgFileChange} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Template name (new)</label>
              <input
                className="input"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={createNewTemplate}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "#2c7be5",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                <FaPlus style={{ marginRight: 6 }} /> Create Template
              </button>
              <button
                onClick={saveLayoutToTemplate}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "#2c7be5",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Save Layout
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Available Fields</h4>
              <div className="vstack">
                {availableFields.length ? (
                  availableFields.map((f: any) => (
                    <button
                      key={f}
                      className="btn-small"
                      onClick={() => addField(f)}
                      style={{
                        marginBottom: 4,
                        padding: "6px 10px",
                        border: "1px solid #ccc",
                        borderRadius: 4,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {f}
                    </button>
                  ))
                ) : (
                  <div className="helper">Select a parent form template</div>
                )}
              </div>
            </div>

            <div>
              <h4 style={{ marginBottom: 8 }}>Selected Element</h4>
              {selectedId ? (
                (() => {
                  const s = elements.find(el => el.id === selectedId)!
                  return (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>{s.name}</div>

                      <div style={{ marginBottom: 8 }}>
                        <label className="form-label">Font family</label>
                        <select
                          value={s.font}
                          onChange={e => updateElement(s.id, { font: e.target.value })}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            outline: "none",
                            width: "100%",
                          }}
                        >
                          <option value="arial.ttf">Arial</option>
                          <option value="arialbd.ttf">Arial Bold</option>
                          <option value="times.ttf">Times</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <label className="form-label">Font size</label>
                        <input
                          type="number"
                          className="input"
                          value={s.size}
                          onChange={e =>
                            updateElement(s.id, { size: Number(e.target.value) })
                          }
                          style={{
                            padding: "6px 8px",
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            outline: "none",
                            width: "100%",
                          }}
                        />
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <label className="form-label">Color</label>
                        <input
                          type="color"
                          value={s.color}
                          onChange={e => updateElement(s.id, { color: e.target.value })}
                          style={{ width: "100%" }}
                        />
                      </div>

                      <button
                        className="button secondary"
                        onClick={() => removeElement(s.id)}
                        style={{
                          marginTop: 12,
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "1px solid #ccc",
                          backgroundColor: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )
                })()
              ) : (
                <div className="helper">Select a placeholder to edit</div>
              )}
            </div>
          </div>

          {/* Preview panel */}
          <div style={{ flex: 1 }}>
            <div
              ref={previewRef}
              style={{
                width: previewWidth,
                height: previewHeight,
                border: "1px solid #ddd",
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
                background: "#fff",
              }}
            >
              {bgPreviewUrl ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${bgPreviewUrl})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                >
                  {elements.map(el => (
                    <Rnd
                      key={el.id}
                      bounds="parent"
                      size={{ width: el.width, height: el.height }}
                      position={{ x: el.x, y: el.y }}
                      onDragStop={(e, d) =>
                        updateElement(el.id, { x: Math.round(d.x), y: Math.round(d.y) })
                      }
                      onResizeStop={(e, dir, ref, delta, pos) =>
                        updateElement(el.id, {
                          width: Math.round(ref.offsetWidth),
                          height: Math.round(ref.offsetHeight),
                          x: Math.round(pos.x),
                          y: Math.round(pos.y),
                        })
                      }
                      onClick={() => setSelectedId(el.id)}
                      style={{
                        border:
                          selectedId === el.id
                            ? "2px solid #2196f3"
                            : "1px dashed #c00",
                        background: el.isImage
                          ? "rgba(0,0,0,0.05)"
                          : "rgba(255,255,255,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "move",
                        color: el.color ?? "#000",
                      }}
                    >
                      <div
                        style={{
                          fontSize: previewFontSize(el),
                          fontFamily: el.font ?? "Arial",
                          width: "100%",
                          textAlign: "center",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {el.isImage ? "PHOTO" : el.name}
                      </div>
                    </Rnd>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 20 }}>Upload/select a background to design</div>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              Tip: place fields relative to background. Coordinates saved in image pixels
              for exact printing.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
