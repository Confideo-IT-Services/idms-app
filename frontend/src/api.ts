// frontend/src/api.ts
import axios from 'axios'

export const api = axios.create({
  baseURL:'http://127.0.0.1:8000/api',
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
          const r = await axios.post('http://127.0.0.1:8000/api/auth/token/refresh/', { refresh })

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

/**
 * attempt to change user password.
 *
 * Tries several common endpoints used by Django/dj-rest-auth/djoser setups:
 * - POST /auth/change-password/ { current_password, new_password }
 * - POST /auth/password/change/ { old_password, new_password1, new_password2 }
 * - POST /auth/users/set_password/ { current_password, new_password }
 *
 * Adjust/remove attempts to match your backend exactly if you know the route.
 *
 * Returns the axios response on success, throws an error with a message on failure.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  // candidate endpoints (prefixed with base '/api' by the `api` instance)
  const attempts = [
    {
      url: '/auth/change-password/',
      payload: { current_password: currentPassword, new_password: newPassword },
    },
    {
      url: '/auth/password/change/',
      payload: { old_password: currentPassword, new_password1: newPassword, new_password2: newPassword },
    },
    {
      url: '/auth/users/set_password/',
      payload: { current_password: currentPassword, new_password: newPassword },
    },
  ];

  let lastErr: any = null;

  for (const a of attempts) {
    try {
      const res = await api.post(a.url, a.payload);
      return res;
    } catch (err: any) {
      lastErr = err;

      // If it's a 404-like "not found", try next attempt. Continue loop.
      // But if it's a 400 with JSON errors, it's probably the correct endpoint but validation failed — still continue so others can be attempted
      // We just record lastErr and continue.
    }
  }

  // After all attempts failed: normalize the error message for the UI.
  if (lastErr) {
    const r = lastErr.response;
    if (r) {
      // If server returned HTML (common with Django 404 debug page), don't expose raw HTML to UI.
      const ct = (r.headers && r.headers['content-type']) || '';
      if (typeof ct === 'string' && ct.includes('text/html')) {
        throw new Error(`Server returned ${r.status} ${r.statusText}. The password-change endpoint was not found on the backend.`);
      }

      // If backend sent JSON, try to extract friendly messages
      const data = r.data;
      if (data) {
        // typical DRF style: {detail: "..."} or field errors like {old_password: ["..."]}
        if (typeof data === 'object') {
          if (data.detail) throw new Error(data.detail);
          // join field errors
          const pieces: string[] = [];
          for (const k of Object.keys(data)) {
            const v = data[k];
            if (Array.isArray(v)) pieces.push(`${k}: ${v.join(' ')}`);
            else if (typeof v === 'string') pieces.push(`${k}: ${v}`);
            else pieces.push(`${k}: ${JSON.stringify(v)}`);
          }
          if (pieces.length) throw new Error(pieces.join(' | '));
        }
        // otherwise fallback
        throw new Error(JSON.stringify(data));
      }

      // fallback to status text
      throw new Error(`Server returned ${r.status} ${r.statusText}`);
    }

    // network error / no response
    throw new Error(lastErr.message || 'Network error while attempting to change password.');
  }

  throw new Error('Unknown error while attempting to change password.');
}