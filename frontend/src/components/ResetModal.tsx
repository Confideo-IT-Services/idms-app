// frontend/src/components/ResetModal.tsx
import { useState } from "react";
import { api } from "../api"; // use same api wrapper used by Login

export default function ResetModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await api.post("/auth/password-reset/", { email });
      // generic message (no enumeration)
      setMsg("If an account exists for that email, a reset link has been sent.");
    } catch (err) {
      // still show generic message on error
      setMsg("If an account exists for that email, a reset link has been sent.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", zIndex: 2000 }}>
      <div style={{ width: 420, background: "#fff", padding: 16, borderRadius: 8 }}>
        <h3 style={{ margin: 0 }}>Reset password</h3>
        <p style={{ marginTop: 6, marginBottom: 12, color: "#444" }}>Enter the email address for your account — we'll email a reset link.</p>

        <form onSubmit={submit}>
          <label style={{ fontSize: 13, color:'#444' }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@school.edu"
            style={{ marginTop: 6 }}
            required
            type="email"
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" className="button" disabled={loading}>{loading ? "Sending..." : "Send reset link"}</button>
            <button type="button" className="button secondary" onClick={onClose}>Cancel</button>
          </div>

          {msg && <div style={{ color: "green", marginTop: 10 }}>{msg}</div>}
        </form>
      </div>
    </div>
  );
}
