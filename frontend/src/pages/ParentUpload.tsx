import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import axios from "axios"

type Field = {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
}

export default function ParentUpload() {
  const { token } = useParams()
  const [schema, setSchema] = useState<Field[]>([])
  const [meta, setMeta] = useState<any>({})
  const [status, setStatus] = useState<string>("Loading...")
  const [schoolInfo, setSchoolInfo] = useState<{ school: string, class: string, section?: string } | null>(null)
  const [fileMap, setFileMap] = useState<Record<string, File | null>>({})

  // parent fetch
  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`/api/public/form/${token}/`)
        console.log("schema:", data)   // TEMP: verify fields arrive
        setSchema(data.fields || [])
        setSchoolInfo({ school: data.school, class: data.class, section: data.section })
        setStatus("")
      } catch (e: any) {
        setStatus(e?.response?.data?.detail || "Invalid or expired link.")
      }
    })()
  }, [token])


  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, files } = e.target as HTMLInputElement
    if (files && files.length) {
      setFileMap(prev => ({ ...prev, [name]: files[0] }))
    } else {
      setMeta((prev: any) => ({ ...prev, [name]: value }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("Submitting...")
    try {
      const fd = new FormData()
      schema.forEach(f => {
        if (f.type === "file") {
          if (fileMap[f.name]) fd.append(f.name, fileMap[f.name] as File)
        } else {
          if (meta[f.name] !== undefined) fd.append(f.name, meta[f.name])
        }
      })
      await axios.post(`/api/public/upload/${token}/`, fd, { headers: { "Content-Type": "multipart/form-data" } })
      setStatus("Thanks! Your details were submitted.")
    } catch (err: any) {
      setStatus(err?.response?.data?.detail || "Submission failed.")
    }
  }

  if (status && !schema.length) return <div style={{ maxWidth: 600, margin: "2rem auto" }}>{status}</div>

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto" }}>
      <h2>Upload Student Details</h2>
      {schoolInfo && (
        <p>
          School: <b>{schoolInfo.school}</b> | Class: <b>{schoolInfo.class}</b>
          {schoolInfo.section ? ` - ${schoolInfo.section}` : ""}
        </p>
      )}
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        {schema.map((f) => {
          const common = { name: f.name, required: !!f.required, onChange } as any
          switch (f.type) {
            case "text":
            case "email":
            case "tel":
            case "date":
              return <input key={f.name} type={f.type} placeholder={f.label} {...common} />
            case "textarea":
              return <textarea key={f.name} placeholder={f.label} {...common} />
            case "select":
              return (
                <select key={f.name} {...common}>
                  <option value="">{f.label}</option>
                  {(f.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )
            case "file":
              return <input key={f.name} type="file" accept="image/*" {...common} />
            default:
              return <input key={f.name} type="text" placeholder={f.label} {...common} />
          }
        })}

        <button type="submit">Submit</button>
      </form>
      <div style={{ marginTop: 10 }}>{status}</div>
    </div>
  )
}
