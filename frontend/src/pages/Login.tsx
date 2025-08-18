import { useState } from 'react'
import { api, setAuth } from '../api'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      const { data } = await api.post('/auth/token/', { username, password })
      localStorage.setItem('access', data.access)
      localStorage.setItem('refresh', data.refresh)
      setAuth(data.access)
      onLogin()
    } catch (e: any) {
      setErr('Invalid credentials')
    }
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 360, margin: '3rem auto' }}>
      <h2>Admin Login</h2>
      <input placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button type="submit">Login</button>
      {err && <div>{err}</div>}
    </form>
  )
}
