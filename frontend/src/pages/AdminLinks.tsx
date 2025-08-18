import { useEffect, useState } from 'react'
import { api } from '../api'
import dayjs from 'dayjs'
import { useSession } from '../session'

type UploadLink = {
  id: number
  token: string
  school: number
  classroom: number
  template?: number
  expires_at: string
  is_active: boolean
  notes: string
  max_uses: number | null
  uses_count: number
}

type School = { id: number; name: string }
type ClassRoom = { id: number; class_name: string; section?: string | null }
type Template = { id: number; name: string }

export default function AdminLinks() {
  const [links, setLinks] = useState<UploadLink[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const { me } = useSession()
  const [form, setForm] = useState({
    school: 0,
    classroom: 0,
    template: 0,
    notes: '',
    days: 14,
    max_uses: '',
  })

  async function loadAll() {
    // super admin may load all schools; school admin shouldn't call /schools
    const reqs = [
      api.get('/upload-links/'),
      api.get('/classes/'),
      api.get('/form-templates/'),
    ]
    if (me?.role === 'SUPER_ADMIN') reqs.splice(1, 0, api.get('/schools/')) // insert schools fetch
    const res = await Promise.all(reqs)
    const [l, maybeSchools, c, t] = me?.role === 'SUPER_ADMIN' ? res : [res[0], null, res[1], res[2]]

    setLinks(l.data)
    // if (maybeSchools) setSchools(maybeSchools.data.results ?? maybeSchools.data)
    setClasses(c.data.results ?? c.data)
    setTemplates(t.data.results ?? t.data)
  }

  useEffect(() => {
    loadAll()
  }, [])

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function createLink(e: React.FormEvent) {
    e.preventDefault()
    const expires_at = dayjs().add(Number(form.days || 14), 'day').toISOString()
    const schoolId = me?.role === 'SCHOOL_ADMIN' ? me.school_id : Number(form.school)
    const tmplId = form.template ? Number(form.template) : null
    if (!tmplId) { alert("Please choose a template"); return }
    await api.post('/upload-links/', {
      // School Admin: DO NOT send 'school' (serializer will attach); Super Admin: send Number(form.school)
      classroom: Number(form.classroom),
      template: tmplId,
      expires_at,
      is_active: true,
      notes: form.notes,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
    })
    await loadAll()
  }

  async function action(path: string) {
    await api.post(path)
    await loadAll()
  }

  return (
    <div style={{ maxWidth: 960, margin: '2rem auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Upload Links</h2>
        <a href="/templates">
          <button type="button">Templates</button>
        </a>
      </div>

      <form
        onSubmit={createLink}
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'repeat(7, 1fr)',
          marginBottom: 20,
        }}
      >
        {me?.role === 'SUPER_ADMIN' && (
          <select name="school" value={form.school} onChange={onChange} required>
            <option value="">Select School</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <select name="classroom" value={form.classroom} onChange={onChange} required>
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.class_name}
              {c.section ? `-${c.section}` : ''}
            </option>
          ))}
        </select>
        <select name="template" value={form.template} onChange={onChange} required>
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
        />
        <input
          name="max_uses"
          placeholder="Max uses (optional)"
          value={form.max_uses}
          onChange={onChange}
        />
        <input name="notes" placeholder="Notes" value={form.notes} onChange={onChange} />
        <button type="submit">Create</button>
      </form>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Token</th>
            <th>Share Link</th>
            <th>Active</th>
            <th>Expires</th>
            <th>Uses</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {links.map((l) => {
            const shareUrl = `${location.origin}/u/${l.token}`
            return (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td style={{ fontFamily: 'monospace' }}>{l.token}</td>
                <td>
                  <a href={shareUrl} target="_blank" rel="noreferrer">
                    {shareUrl}
                  </a>
                </td>
                <td>{l.is_active ? 'Yes' : 'No'}</td>
                <td>{dayjs(l.expires_at).format('YYYY-MM-DD')}</td>
                <td>{templates.find(t => t.id === l.template)?.name ?? <i>None</i>}</td>
                <td>
                  {l.uses_count}
                  {l.max_uses ? ` / ${l.max_uses}` : ''}
                </td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => action(`/api/upload-links/${l.id}/activate/`)}>
                    Activate
                  </button>
                  <button onClick={() => action(`/api/upload-links/${l.id}/deactivate/`)}>
                    Deactivate
                  </button>
                  <button onClick={() => action(`/api/upload-links/${l.id}/extend/`)}>
                    Extend +7d
                  </button>
                  <button onClick={() => action(`/api/upload-links/${l.id}/rotate_token/`)}>
                    Rotate
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Delete this link?")) {
                        await api.delete(`/upload-links/${l.id}/`)
                        setLinks(links.filter(x => x.id !== l.id))
                      }
                    }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Delete all expired links?")) {
                        const res = await api.delete('/upload-links/cleanup/')
                        alert(`Deleted ${res.data.deleted} expired links`)
                        // refresh list
                        const { data } = await api.get('/upload-links/')
                        setLinks(data)
                      }
                    }}
                  >
                    Cleanup Expired
                  </button>

                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
