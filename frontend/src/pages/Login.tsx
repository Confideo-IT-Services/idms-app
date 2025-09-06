import { useState } from 'react'
import { useNavigate } from "react-router-dom"
import { api, setAuth } from '../api'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)

  async function doLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErr(null)
    try {
      const { data } = await api.post('/auth/token/', { username, password })
      localStorage.setItem('access', data.access)
      localStorage.setItem('refresh', data.refresh)
      setAuth(data.access)
      onLogin()
    } catch (e: any) {
      setErr('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h2 className="login-title">ID Card Management System — Login</h2>
        <p className="helper">Sign in to manage schools, templates and generate IDs.</p>

        <form onSubmit={doLogin} style={{ marginTop: 12 }}>
          <label className="form-label">Username</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} />

          <label className="form-label" style={{ marginTop: 12 }}>Password</label>
          <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} />

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="button" type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
            <button type="button" className="button secondary" onClick={() => { setUsername(""); setPassword("") }}>Reset</button>
          </div>
        </form>
      </div>
    </div>
  )
}
