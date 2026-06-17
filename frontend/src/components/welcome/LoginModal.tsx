import { useEffect, useRef, useState } from "react";

// A small sign-in modal. Auth is a stub for now: dev / 123. On success the
// parent flips to the signed-in state; on failure we show an inline error.
export function LoginModal({ onClose, onLogin }: { onClose: () => void; onLogin: (user: string, pass: string) => boolean }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<HTMLInputElement>(null);

  useEffect(() => { userRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!onLogin(user.trim(), pass)) {
      setError("Incorrect username or password.");
      setPass("");
    }
  }

  return (
    <div className="login-overlay" onPointerDown={onClose}>
      <form className="login-card" onPointerDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="login-x" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-sub">Sign in to see your projects and pages.</p>

        <label className="login-field">
          <span>Username</span>
          <input ref={userRef} value={user} onChange={(e) => { setUser(e.target.value); setError(null); }} autoComplete="username" placeholder="dev" />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setError(null); }} autoComplete="current-password" placeholder="••••" />
        </label>

        {error && <div className="login-err">{error}</div>}

        <button type="submit" className="login-submit">Sign in</button>
        <div className="login-hint">Demo credentials — <b>dev</b> / <b>123</b></div>
      </form>
    </div>
  );
}
