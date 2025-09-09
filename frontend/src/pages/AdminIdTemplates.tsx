// frontend/src/pages/AdminIdTemplates.tsx
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Rnd } from "react-rnd"
import { api } from "../api"

type Element = {
  id: number
  name: string
  // preview coords (pixels inside preview container)
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
  const previewWidth = 700   // preview container width in px
  const previewHeight = 900  // preview container height in px
  const previewRef = useRef<HTMLDivElement|null>(null)

  const [schools, setSchools] = useState<any[]>([])
  const [formTemplates, setFormTemplates] = useState<any[]>([])
  const [idTemplates, setIdTemplates] = useState<any[]>([])

  const [schoolId, setSchoolId] = useState<number | "">("")
  const [selectedFormTemplateId, setSelectedFormTemplateId] = useState<number | "">("")
  const [selectedIdTemplateId, setSelectedIdTemplateId] = useState<number | "">("")
  const [selectedTemplate, setSelectedTemplate] = useState<any|null>(null)

  const [bgFile, setBgFile] = useState<File | null>(null)
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string>("")
  const [bgNaturalW, setBgNaturalW] = useState<number>(0)   // natural image pixels width
  const [bgNaturalH, setBgNaturalH] = useState<number>(0)
  const [elements, setElements] = useState<Element[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [newName, setNewName] = useState("")
  const [isDefault, setIsDefault] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [cardSizeMM, setCardSizeMM] = useState<{w:number,h:number}>({w:54, h:86}) // default 54x86 mm

  // load schools
  useEffect(() => {
    api.get("/schools/").then(res => setSchools(res.data.results ?? res.data)).catch(()=>setSchools([]))
  }, [])

  // when school changes, load form templates (all) and id templates
  useEffect(() => {
    async function load() {
      if (!schoolId) {
        setFormTemplates([]); setIdTemplates([]); setSelectedFormTemplateId(""); setSelectedIdTemplateId(""); setSelectedTemplate(null)
        setBgPreviewUrl(""); setElements([]); return
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
          const def = idData.find((t:any)=>t.is_default) ?? idData[0]
          setSelectedIdTemplateId(def.id)
          setBgPreviewUrl(def.background_url ?? def.background ?? "")
          // set card size if saved on template
          if (def.card_size_mm) setCardSizeMM(def.card_size_mm)
        }
      } catch(e) { setIdTemplates([]) }
    }
    load()
  }, [schoolId])

  // when selected id template changes -> load its fields to elements (convert image px -> preview px)
  useEffect(() => {
    const tpl = idTemplates.find(t => String(t.id) === String(selectedIdTemplateId) || t.id === selectedIdTemplateId) ?? null
    setSelectedTemplate(tpl)
    if (!tpl) {
      setElements([]); setBgPreviewUrl(""); setBgNaturalW(0); setBgNaturalH(0); return
    }
    // background url preference
    const url = tpl.background_url ?? tpl.background ?? ""
    setBgPreviewUrl(url)
    // set card size if present
    if (tpl.card_size_mm) setCardSizeMM(tpl.card_size_mm)

    // fields in template are stored in image-pixel coords; convert to preview coords
    // but we need natural image size; we'll fetch image to get its natural size, then convert
    if (url) {
      const img = new Image()
      img.onload = () => {
        const natW = img.naturalWidth, natH = img.naturalHeight
        setBgNaturalW(natW); setBgNaturalH(natH)
        const scale = Math.min(previewWidth/natW, previewHeight/natH)
        const fields = tpl.fields ?? {}
        const elems: Element[] = Object.keys(fields).map((k,i) => {
          const cfg = fields[k]
          const imageX = Number(cfg.x ?? 0), imageY = Number(cfg.y ?? 0)
          const imageW = Number(cfg.width ?? cfg.w ?? 100), imageH = Number(cfg.height ?? cfg.h ?? 30)
          const px = Math.round(imageX * scale)
          const py = Math.round(imageY * scale)
          const pw = Math.round(imageW * scale)
          const ph = Math.round(imageH * scale)
          return {
            id: Date.now() + i,
            name: k,
            x: px, y: py, width: pw, height: ph,
            font: cfg.font ?? "arial.ttf", size: cfg.size ?? Math.round(ph*0.45), color: cfg.color ?? "#000000",
            isImage: !!cfg.isImage || k === "photo"
          }
        })
        setElements(elems)
      }
      img.onerror = () => {
        // can't load, just map naively (avoid crash)
        setBgNaturalW(0); setBgNaturalH(0)
        setElements([])
      }
      img.src = url
    } else {
      // no background - clear
      setBgNaturalW(0); setBgNaturalH(0); setElements([])
    }
  }, [selectedIdTemplateId, idTemplates])

  // when preview bgFile chosen locally for new template or update, load natural size
  function onBgFileChange(e:React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setBgFile(f)
    if (!f) { setBgPreviewUrl(""); setBgNaturalW(0); setBgNaturalH(0); return }
    const url = URL.createObjectURL(f)
    setBgPreviewUrl(url)
    const img = new Image()
    img.onload = () => { setBgNaturalW(img.naturalWidth); setBgNaturalH(img.naturalHeight) }
    img.onerror = () => { setBgNaturalW(0); setBgNaturalH(0) }
    img.src = url
  }

  // compute available fields from selected parent form template
  const availableFields = useMemo(() => {
    const ft = formTemplates.find(f => String(f.id) === String(selectedFormTemplateId) || f.id === selectedFormTemplateId)
    if (!ft) return []
    // ft.fields might be array of objects or object map.
    // support both:
    const keys:any[] = []
    if (Array.isArray(ft.fields)) {
      // array of field definitions: use 'name' then label or fallback to name
      for (const obj of ft.fields) {
        if (typeof obj === "string") keys.push(obj)
        else keys.push(obj.name ?? obj.label ?? JSON.stringify(obj))
      }
    } else if (typeof ft.fields === "object") {
      // map: keys are field names
      for (const k of Object.keys(ft.fields)) keys.push(k)
    }
    return keys
  }, [formTemplates, selectedFormTemplateId])

  // add placeholder in preview coords
  function addField(fieldName:string){
    const isImage = fieldName === "photo"
    const el:Element = {
      id: Date.now()+Math.floor(Math.random()*1000),
      name: fieldName,
      x: 20, y: 20,
      width: isImage ? 120 : 160,
      height: isImage ? 160 : 40,
      font: "arial.ttf",
      size: isImage ? 12 : 16,
      color: "#000000",
      isImage
    }
    setElements(s => [...s, el])
    setSelectedId(el.id)
  }

  function updateElement(id:number, patch:Partial<Element>){
    setElements(s => s.map(e => e.id===id ? {...e, ...patch} : e))
  }
  function removeElement(id:number){
    setElements(s => s.filter(e => e.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // convert preview coords -> image pixels (natural)
  function convertPreviewToImageCoords(el:Element) {
    if (!bgNaturalW || !bgNaturalH) {
      // no natural size - assume 1:1
      return {
        x: Math.round(el.x),
        y: Math.round(el.y),
        width: Math.round(el.width),
        height: Math.round(el.height),
      }
    }
    const scale = Math.min(previewWidth/bgNaturalW, previewHeight/bgNaturalH)
    const imageX = Math.round(el.x / scale)
    const imageY = Math.round(el.y / scale)
    const imageW = Math.round(el.width / scale)
    const imageH = Math.round(el.height / scale)
    return { x: imageX, y: imageY, width: imageW, height: imageH }
  }

  // convert image pixels -> preview coords
  function convertImageToPreviewCoords(cfg:any) {
    if (!bgNaturalW || !bgNaturalH) return { x: cfg.x||0, y: cfg.y||0, width: cfg.width||100, height: cfg.height||30 }
    const scale = Math.min(previewWidth/bgNaturalW, previewHeight/bgNaturalH)
    return {
      x: Math.round((cfg.x||0) * scale),
      y: Math.round((cfg.y||0) * scale),
      width: Math.round((cfg.width||100) * scale),
      height: Math.round((cfg.height||30) * scale),
    }
  }

  // Save layout to selected template (PATCH)
  async function saveLayoutToTemplate(){
    setStatusMsg(null)
    if (!selectedIdTemplateId) { setStatusMsg("No ID template selected"); return }
    try {
      const fieldsMap:any = {}
      for (const el of elements) {
        const imgcoords = convertPreviewToImageCoords(el)
        fieldsMap[el.name] = {
          x: imgcoords.x, y: imgcoords.y, width: imgcoords.width, height: imgcoords.height,
          font: el.font, size: el.size ?? Math.round(el.height*0.45), color: el.color, isImage: !!el.isImage
        }
      }

      const form = new FormData()
      form.append("fields", JSON.stringify(fieldsMap))
      form.append("card_size_mm", JSON.stringify(cardSizeMM))
      form.append("is_default", String(isDefault))
      if (bgFile) form.append("background", bgFile)

      await api.patch(`/id-templates/${selectedIdTemplateId}/`, form, { headers: { "Content-Type": "multipart/form-data" } })

      // refresh templates for school
      const refreshed = await api.get(`/id-templates/?school=${schoolId}`)
      setIdTemplates(refreshed.data.results ?? refreshed.data)
      setStatusMsg("Template updated")
    } catch (err:any) {
      setStatusMsg("Failed to save: " + (err?.response?.data ? JSON.stringify(err.response.data) : err.message))
    }
  }

  // Create new template (POST)
  async function createNewTemplate(){
    setStatusMsg(null)
    if (!schoolId) { setStatusMsg("Select school"); return }
    if (!newName) { setStatusMsg("Provide name"); return }
    if (!bgFile) { setStatusMsg("Upload background"); return }
    try {
      const fieldsMap:any = {}
      for (const el of elements) {
        const imgcoords = convertPreviewToImageCoords(el)
        fieldsMap[el.name] = {
          x: imgcoords.x, y: imgcoords.y, width: imgcoords.width, height: imgcoords.height,
          font: el.font, size: el.size ?? Math.round(el.height*0.45), color: el.color, isImage: !!el.isImage
        }
      }
      const form = new FormData()
      form.append("school", String(schoolId))
      form.append("name", newName)
      form.append("fields", JSON.stringify(fieldsMap))
      form.append("is_default", String(isDefault))
      form.append("background", bgFile)
      form.append("card_size_mm", JSON.stringify(cardSizeMM))
      await api.post(`/id-templates/`, form, { headers: { "Content-Type": "multipart/form-data" } })

      const refreshed = await api.get(`/id-templates/?school=${schoolId}`)
      setIdTemplates(refreshed.data.results ?? refreshed.data)
      setBgFile(null); setBgPreviewUrl(""); setElements([]); setNewName("")
      setStatusMsg("Template created")
    } catch (err:any) {
      setStatusMsg("Failed to create: " + (err?.response?.data ? JSON.stringify(err.response.data) : err.message))
    }
  }

  // helper: preview font size
  function previewFontSize(el:Element){ return Math.max(8, Math.round((el.size ?? Math.round(el.height*0.45)))) }

  // UI render
  return (
    <div className="app-container">
      <div className="card">
        <h2>ID Template Designer</h2>
        {statusMsg && <div style={{ color: "#b00020", marginBottom: 8 }}>{statusMsg}</div>}

        <div style={{ display:"flex", gap:12, marginBottom:12 }}>
          <select value={schoolId as any} onChange={e => setSchoolId(e.target.value==="" ? "" : Number(e.target.value))}>
            <option value="">-- Select School --</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select value={selectedFormTemplateId as any} onChange={e => setSelectedFormTemplateId(e.target.value==="" ? "" : Number(e.target.value))}>
            <option value="">-- Parent Form Template --</option>
            {formTemplates.map((f:any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <select value={selectedIdTemplateId as any} onChange={e => setSelectedIdTemplateId(e.target.value==="" ? "" : Number(e.target.value))}>
            <option value="">-- ID Template --</option>
            {idTemplates.map((t:any) => <option key={t.id} value={t.id}>{t.name} {t.is_default ? "(default)" : ""}</option>)}
          </select>

          <label style={{ display:"flex", alignItems:"center", gap:8 }}>
            <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} /> Set default
          </label>

          <label style={{ display:"flex", alignItems:"center", gap:8 }}>
            Card size:
            <select value={`${cardSizeMM.w}x${cardSizeMM.h}`} onChange={(e) => {
              const [w,h] = e.target.value.split("x").map(Number); setCardSizeMM({w,h})
            }}>
              <option value="54x86">54 x 86 mm</option>
              <option value="48x72">48 x 72 mm</option>
            </select>
          </label>
        </div>

        <div style={{ display:"flex", gap:18 }}>
          <div style={{ minWidth:260 }}>
            <h4>Controls</h4>
            <div style={{ marginBottom:8 }}>
              <label className="form-label">Upload / Replace background</label>
              <input type="file" accept="image/*" onChange={onBgFileChange} />
            </div>

            <div style={{ marginBottom:8 }}>
              <label className="form-label">Template name (new)</label>
              <input className="input" value={newName} onChange={e=>setNewName(e.target.value)} />
            </div>

            <div style={{ display:"flex", gap:8 }}>
              <button className="button" onClick={createNewTemplate}>Create New Template</button>
              <button className="button secondary" onClick={saveLayoutToTemplate}>Save Layout to Selected Template</button>
            </div>

            <div style={{ marginTop:16 }}>
              <h4>Available fields</h4>
              <div className="vstack">
                {availableFields.length ? availableFields.map((f:any) => (
                  <button key={f} className="btn-small" onClick={() => addField(f)}>{f}</button>
                )) : <div className="helper">Select a parent form template to see fields</div>}
              </div>
            </div>

            <div style={{ marginTop:18 }}>
              <h4>Selected element</h4>
              {selectedId ? (() => {
                const s = elements.find(el => el.id === selectedId)!
                return (
                  <div>
                    <div style={{ fontWeight:600 }}>{s.name}</div>
                    <div style={{ marginTop:8 }}>
                      <label className="form-label">Font family</label>
                      <select value={s.font} onChange={e=>updateElement(s.id,{font:e.target.value})}>
                        <option value="arial.ttf">Arial</option>
                        <option value="arialbd.ttf">Arial Bold</option>
                        <option value="times.ttf">Times</option>
                      </select>
                    </div>
                    <div style={{ marginTop:8 }}>
                      <label className="form-label">Font size</label>
                      <input type="number" className="input" value={s.size} onChange={e=>updateElement(s.id,{size: Number(e.target.value)})} />
                    </div>
                    <div style={{ marginTop:8 }}>
                      <label className="form-label">Color</label>
                      <input type="color" value={s.color} onChange={e=>updateElement(s.id,{color: e.target.value})} />
                    </div>
                    <div style={{ marginTop:8 }}>
                      <button className="button secondary" onClick={()=>removeElement(s.id)}>Remove</button>
                    </div>
                  </div>
                )
              })() : <div>Select a placeholder to edit</div>}
            </div>
          </div>

          <div style={{ flex:1 }}>
            <div style={{ width: previewWidth, height: previewHeight, border:"1px solid #ddd", position:"relative", overflow:"hidden", background:"#fff" }} ref={previewRef}>
              {bgPreviewUrl ? (
                <div style={{ position:"absolute", inset:0, backgroundImage:`url(${bgPreviewUrl})`, backgroundSize:"contain", backgroundRepeat:"no-repeat", backgroundPosition:"center" }}>
                  {elements.map(el => (
                    <Rnd
                      key={el.id}
                      bounds="parent"
                      size={{ width: el.width, height: el.height }}
                      position={{ x: el.x, y: el.y }}
                      onDragStop={(e,d) => updateElement(el.id, { x: Math.round(d.x), y: Math.round(d.y) })}
                      onResizeStop={(e,dir, ref, delta, pos) => updateElement(el.id, { width: Math.round(ref.offsetWidth), height: Math.round(ref.offsetHeight), x: Math.round(pos.x), y: Math.round(pos.y) })}
                      onClick={() => setSelectedId(el.id)}
                      style={{ border: selectedId===el.id ? "2px solid #2196f3" : "1px dashed #c00", background: el.isImage ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.6)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"move", color: el.color ?? "#000" }}
                    >
                      <div style={{ fontSize: previewFontSize(el), fontFamily: el.font ?? "Arial", width:"100%", textAlign:"center", overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>
                        {el.isImage ? "PHOTO" : el.name}
                      </div>
                    </Rnd>
                  ))}
                </div>
              ) : <div style={{ padding:20 }}>Upload/select a background to design</div>}
            </div>
            <div style={{ marginTop:8, fontSize:12, color:"#666" }}>Tip: place fields relative to background. Coordinates saved in image pixels for exact printing.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
