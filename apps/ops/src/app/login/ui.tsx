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
      setError(data.error ?? "登录失败，请稍后重试。");
      setLoading(false);
      return;
    }
    window.location.assign(
      data.role === "editor" ? "/facts" : data.role === "operator" ? "/tasks" : "/roles",
    );
  }

  return (
    <section className="loginPanel">
      <p className="eyebrow">受限运营区域</p>
      <h1>登录 VisePanda 运营后台</h1>
      <p className="muted">普通旅行者账号不具备运营后台访问权限。</p>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          邮箱
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          密码
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
          {loading ? "登录中…" : "登录"}
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
