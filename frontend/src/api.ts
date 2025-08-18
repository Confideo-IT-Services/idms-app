// frontend/src/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

export function setAuth(token: string | null) {
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  else delete api.defaults.headers.common['Authorization']
}

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh')
      if (refresh) {
        try {
          const r = await axios.post('/api/auth/token/refresh/', { refresh })
          const newAccess = r.data.access
          localStorage.setItem('access', newAccess)
          setAuth(newAccess)
          original.headers = original.headers || {}
          original.headers.Authorization = `Bearer ${newAccess}`
          return api.request(original)
        } catch (_) {
          // fall through to reject
        }
      }
    }
    return Promise.reject(error)
  }
)