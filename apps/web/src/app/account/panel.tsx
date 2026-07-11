"use client";

import { useEffect, useState, type FormEvent } from "react";

type SessionResponse =
  | { ok: true; authenticated: boolean; user: { email: string | null } | null }
  | { ok: false; error: string };

export function AccountPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refreshSession();
  }, []);

  async function refreshSession() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await response.json()) as SessionResponse;
      if (!response.ok || !data.ok) throw new Error(data.ok ? "Session check failed." : data.error);
      setSessionEmail(data.authenticated ? (data.user?.email ?? "Signed in") : null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Session check failed.");
    } finally {
      setLoading(false);
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Login failed.");
      setPassword("");
      await refreshSession();
      const claimResponse = await fetch("/api/trips/claim", { method: "POST" });
      const claim = (await claimResponse.json()) as { ok: boolean; error?: string };
      if (!claimResponse.ok || !claim.ok) {
        setError(
          claim.error ?? "Signed in, but anonymous trips could not be moved to this account.",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed.");
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error ?? "Logout failed.");
      await refreshSession();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Logout failed.");
      setLoading(false);
    }
  }

  return (
    <main className="accountPage">
      <a className="brandMark" href="/">
        <span>V</span>
        <b>VisePanda</b>
      </a>
      <section className="accountPanel">
        <p className="eyebrow">Traveler account</p>
        <h1>{sessionEmail ? "Your session is active" : "Sign in to keep your trips"}</h1>
        <p>
          Authentication is verified by the server. Anonymous planning remains available without an
          account.
        </p>
        {loading ? (
          <p role="status">Checking session...</p>
        ) : sessionEmail ? (
          <div className="accountSession">
            <span>Signed in as</span>
            <strong>{sessionEmail}</strong>
            <button onClick={() => void logout()} type="button">
              Sign out
            </button>
          </div>
        ) : (
          <form className="accountForm" onSubmit={(event) => void login(event)}>
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button disabled={loading} type="submit">
              Sign in
            </button>
          </form>
        )}
        {error ? (
          <p className="accountError" role="alert">
            {error}
          </p>
        ) : null}
        <a className="backLink" href="/">
          Back to Copilot
        </a>
      </section>
    </main>
  );
}
