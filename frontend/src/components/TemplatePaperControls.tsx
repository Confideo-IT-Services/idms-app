import React, { useEffect, useState } from "react"
import { api } from "../api"

type Props = {
  templateId: number | null
  schoolId?: number | null
  classroomId?: number | null
}

export default function TemplatePaperControls({ templateId, schoolId, classroomId }: Props) {
  const [paper, setPaper] = useState<string>("A4")
  const [cardW, setCardW] = useState<number>(54)
  const [cardH, setCardH] = useState<number>(86)
  const [gridInfo, setGridInfo] = useState<any>(null)
  const [previewUrl, setPreviewUrl] = useState<string>("")
  const [loadingGrid, setLoadingGrid] = useState(false)

  useEffect(() => {
    if (!templateId) return
    fetchGrid()
    fetchPreview()
  }, [templateId, paper, cardW, cardH])

  async function fetchGrid() {
    if (!templateId) return
    setLoadingGrid(true)
    try {
      const res = await api.get(`/id-templates/${templateId}/grid/`, {
        params: { paper, card_w_mm: cardW, card_h_mm: cardH }
      })
      setGridInfo(res.data)
    } catch (err:any) {
      console.error(err)
      setGridInfo(null)
    } finally { setLoadingGrid(false) }
  }

  function fetchPreview() {
    if (!templateId) { setPreviewUrl(""); return }
    // we can append a cache-bust timestamp
    const url = `/api/id-templates/${templateId}/preview/?sample=true&_=${Date.now()}`
    setPreviewUrl(url) // browser will load it when img src set
  }

  async function handleGenerate() {
    if (!templateId) { alert("Select a template"); return }
    if (!schoolId || !classroomId) { alert("Select school and class first"); return }
    try {
      const res = await api.get(`/students/generate_ids/`, {
        params: { school: schoolId, classroom: classroomId, paper, card_size: `${cardW}x${cardH}` },
        responseType: "blob"
      })
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `idcards_${templateId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err:any) {
      alert("Failed to generate PDF: " + (err?.response?.data?.detail || err.message))
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>Paper:
          <select value={paper} onChange={(e) => setPaper(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
            <option value="12x18">12 x 18 in</option>
            <option value="13x19">13 x 19 in</option>
          </select>
        </label>

        <label>Card (mm):
          <select value={`${cardW}x${cardH}`} onChange={(e) => {
            const [w,h] = e.target.value.split("x").map(Number)
            setCardW(w); setCardH(h)
          }} style={{ marginLeft: 6 }}>
            <option value="54x86">54 x 86</option>
            <option value="48x72">48 x 72</option>
          </select>
        </label>

        <button onClick={fetchGrid} className="button secondary">Compute Grid</button>
        <button onClick={fetchPreview} className="button">Refresh Preview</button>
        <button onClick={handleGenerate} className="button">Generate PDF</button>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <div style={{ width: 320 }}>
          <div style={{ fontWeight: 700 }}>Grid info</div>
          {loadingGrid ? <div>Computing...</div> : gridInfo ? (
            <div>
              <div>Paper: {gridInfo.paper}</div>
              <div>Cols × Rows: {gridInfo.cols} × {gridInfo.rows}</div>
              <div>Cards per page: {gridInfo.per_page}</div>
              <div>Margin (mm): {gridInfo.margin_mm}, Spacing (mm): {gridInfo.spacing_mm}</div>
            </div>
          ) : <div>No grid info</div>}
        </div>

        <div>
          <div style={{ fontWeight: 700 }}>Preview</div>
          {previewUrl ? (
            <img src={previewUrl} alt="preview" style={{ width: 240, border: "1px solid #ddd" }} />
          ) : <div>No preview available</div>}
        </div>
      </div>
    </div>
  )
}
