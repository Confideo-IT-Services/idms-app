// frontend/src/pages/ResetPassword.tsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { api } from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const { token: tokenParam } = useParams<{ token?: string }>();
  const navigate = useNavigate();
  // Prefer path param, fall back to query param
  const token = tokenParam || searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) setErr("Missing reset token. Use the link from your email.");
  }, [token]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    setMsg(null);

    if (!token) {
      setErr("Missing token.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/password-reset-confirm/", { token, password });
      setMsg("Password updated. Redirecting to login...");
      setTimeout(() => navigate("/login"), 1400);
    } catch (e: any) {
      const data = e?.response?.data;
      const friendly =
        data?.detail ||
        (typeof data === "string" ? data : null) ||
        data?.error ||
        e?.message ||
        "Failed to reset password. Token may be invalid or expired.";
      setErr(String(friendly));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: "48px auto" }}>
      <h2>Choose a new password</h2>
      <p style={{ color: "#666" }}>Enter your new password below.</p>

      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <label className="form-label">New password</label>
        <div style={{ position: "relative" }}>
          <input
            className="input"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <span
            onClick={() => setShowPw(!showPw)}
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              cursor: "pointer",
              color: "#666",
            }}
            title={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <label className="form-label" style={{ marginTop: 12 }}>
          Confirm password
        </label>
        <div style={{ position: "relative" }}>
          <input
            className="input"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <span
            onClick={() => setShowConfirm(!showConfirm)}
            style={{
              position: "absolute",
              right: 10,
              top: 10,
              cursor: "pointer",
              color: "#666",
            }}
            title={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <FaEyeSlash /> : <FaEye />}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save password"}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate("/login")}
          >
            Cancel
          </button>
        </div>

        {msg && <div style={{ color: "green", marginTop: 10 }}>{msg}</div>}
        {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}
      </form>
    </div>
  );
}
