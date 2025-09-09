// frontend/src/session.tsx
import { createContext, useContext, useEffect, useState } from "react"
import { api, setAuth } from "./api"

type Me = { username: string; role: "SUPER_ADMIN" | "SCHOOL_ADMIN" | ""; school_id: number | null }
const SessionCtx = createContext<{ me: Me | null, loading: boolean, refresh: () => Promise<void> }>({ me: null, loading: true, refresh: async () => {} })

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const access = localStorage.getItem("access")
    if (access) setAuth(access)
    try {
      const { data } = await api.get("/me/")
      setMe(data)
    } catch {
      setMe(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])
  return <SessionCtx.Provider value={{ me, loading, refresh }}>{children}</SessionCtx.Provider>
}

export function useSession() { return useContext(SessionCtx) }
