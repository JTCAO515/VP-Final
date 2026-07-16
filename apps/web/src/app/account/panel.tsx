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
    <section className="accountStage" aria-labelledby="account-title">
      <div className="accountPanel">
        <p className="pageEyebrow">Traveler account</p>
        <h1 id="account-title">
          {sessionEmail ? "Your session is active" : "Keep your trip close."}
        </h1>
        <p>
          Sign in to keep your travel plans with you. You can still ask the Copilot without an
          account.
        </p>
        {loading ? (
          <div className="accountLoading" role="status">
            <span aria-hidden="true" />
            Checking your session
          </div>
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
                placeholder="you@example.com"
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
                placeholder="At least 8 characters"
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
          Continue without signing in
        </a>
      </div>

      <aside className="accountProduct" aria-label="VisePanda product preview">
        <div className="accountProductChrome">
          <span aria-hidden="true" />
          <b>Your China arrival plan</b>
          <small>Product preview</small>
        </div>
        <div className="accountProductBody">
          <p className="pageEyebrow">Tomorrow · Shanghai</p>
          <h2>A calm first day, ready when you land.</h2>
          <div className="accountProductSteps">
            <div>
              <time>09:30</time>
              <span>
                <b>Get connected</b>
                <small>Activate your travel connection first.</small>
              </span>
            </div>
            <div>
              <time>11:00</time>
              <span>
                <b>Set up payment</b>
                <small>Keep one backup option available.</small>
              </span>
            </div>
            <div>
              <time>14:00</time>
              <span>
                <b>Move with confidence</b>
                <small>Choose the simplest route to your hotel.</small>
              </span>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
