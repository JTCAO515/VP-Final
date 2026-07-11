"use client";

import { useState, type FormEvent } from "react";

export function OpsLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json()) as { ok: boolean; role?: string; error?: string };
    if (!response.ok || !data.ok) {
      setError(data.error ?? "Sign in failed.");
      setLoading(false);
      return;
    }
    window.location.assign(
      data.role === "editor" ? "/facts" : data.role === "operator" ? "/tasks" : "/roles",
    );
  }

  return (
    <section className="loginPanel">
      <p className="eyebrow">Restricted operations</p>
      <h1>Sign in to VisePanda Ops</h1>
      <p className="muted">Traveler accounts do not receive operational access.</p>
      <form onSubmit={(event) => void submit(event)}>
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
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error ? (
        <p className="danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
