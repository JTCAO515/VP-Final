"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "../../i18n/locale-provider";

type SessionResponse =
  | { ok: true; authenticated: boolean; user: { email: string | null } | null }
  | { ok: false; error: string };
type AuthMode = "login" | "register";

export function AccountPanel() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/auth/${authMode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        confirmationRequired?: boolean;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ?? (authMode === "register" ? "Registration failed." : "Login failed."),
        );
      }
      setPassword("");
      if (authMode === "register" && data.confirmationRequired) {
        setAuthMode("login");
        setNotice("Check your email to confirm the account, then sign in here.");
        setLoading(false);
        return;
      }
      await refreshSession();
      const claimResponse = await fetch("/api/trips/claim", { method: "POST" });
      const claim = (await claimResponse.json()) as { ok: boolean; error?: string };
      if (!claimResponse.ok || !claim.ok) {
        setError(
          claim.error ?? "Signed in, but anonymous trips could not be moved to this account.",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
      setLoading(false);
    }
  }

  function chooseAuthMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setError(null);
    setNotice(null);
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
        <p className="pageEyebrow">{t("account.eyebrow")}</p>
        <h1 id="account-title">{sessionEmail ? t("account.active") : t("account.title")}</h1>
        <p>{t("account.lead")}</p>
        {loading ? (
          <div className="accountLoading" role="status">
            <span aria-hidden="true" />
            {t("account.checking")}
          </div>
        ) : sessionEmail ? (
          <div className="accountSession">
            <span>{t("account.signedInAs")}</span>
            <strong>{sessionEmail}</strong>
            <button onClick={() => void logout()} type="button">
              {t("account.signOut")}
            </button>
          </div>
        ) : (
          <form className="accountForm" onSubmit={(event) => void authenticate(event)}>
            <div className="accountMode" aria-label={t("account.action")}>
              <button
                aria-pressed={authMode === "login"}
                onClick={() => chooseAuthMode("login")}
                type="button"
              >
                {t("account.signIn")}
              </button>
              <button
                aria-pressed={authMode === "register"}
                onClick={() => chooseAuthMode("register")}
                type="button"
              >
                {t("account.create")}
              </button>
            </div>
            <label>
              {t("account.email")}
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
              {t("account.password")}
              <input
                autoComplete={authMode === "register" ? "new-password" : "current-password"}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("account.passwordHint")}
                required
                type="password"
                value={password}
              />
            </label>
            <button disabled={loading} type="submit">
              {authMode === "register" ? t("account.create") : t("account.signIn")}
            </button>
          </form>
        )}
        {notice ? (
          <p className="accountNotice" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="accountError" role="alert">
            {error}
          </p>
        ) : null}
        <a className="backLink" href="/visepanda">
          {t("account.continue")}
        </a>
      </div>

      <aside className="accountProduct" aria-label={t("account.preview")}>
        <div className="accountProductChrome">
          <span aria-hidden="true" />
          <b>{t("account.plan")}</b>
          <small>{t("account.previewLabel")}</small>
        </div>
        <div className="accountProductBody">
          <p className="pageEyebrow">{t("account.tomorrow")}</p>
          <h2>{t("account.planTitle")}</h2>
          <div className="accountProductSteps">
            <div>
              <time>09:30</time>
              <span>
                <b>{t("account.connected")}</b>
                <small>{t("account.connectedLead")}</small>
              </span>
            </div>
            <div>
              <time>11:00</time>
              <span>
                <b>{t("account.payment")}</b>
                <small>{t("account.paymentLead")}</small>
              </span>
            </div>
            <div>
              <time>14:00</time>
              <span>
                <b>{t("account.move")}</b>
                <small>{t("account.moveLead")}</small>
              </span>
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}
