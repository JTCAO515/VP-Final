"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "../../i18n/locale-provider";

type SessionResponse =
  | { ok: true; authenticated: boolean; user: { email: string | null } | null }
  | { ok: false; error: string };
type AuthMode = "login" | "register" | "recover" | "reset";

export function AccountPanel() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void refreshSession();
    const recovery = new URLSearchParams(window.location.search).get("recovery");
    if (recovery === "1") setAuthMode("reset");
    if (recovery === "failed") {
      setAuthMode("recover");
      setError(t("account.recoveryInvalid"));
    }
  }, []);

  async function refreshSession() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await response.json()) as SessionResponse;
      if (!response.ok || !data.ok)
        throw new Error(data.ok ? t("account.sessionCheckFailed") : data.error);
      setSessionEmail(data.authenticated ? (data.user?.email ?? t("account.signedIn")) : null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("account.sessionCheckFailed"));
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
      if (authMode === "recover") {
        const response = await fetch("/api/auth/recover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? t("account.recoveryUnavailable"));
        }
        setNotice(t("account.recoveryRequested"));
        setLoading(false);
        return;
      }

      if (authMode === "reset") {
        if (password !== passwordConfirmation) {
          throw new Error(t("account.passwordMismatch"));
        }
        const response = await fetch("/api/auth/recover/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = (await response.json()) as { ok: boolean; error?: string };
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? t("account.passwordUpdateFailed"));
        }
        setPassword("");
        setPasswordConfirmation("");
        setAuthMode("login");
        window.history.replaceState({}, "", "/account");
        setNotice(t("account.passwordUpdated"));
        await refreshSession();
        return;
      }

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
          data.error ??
            (authMode === "register" ? t("account.registrationFailed") : t("account.loginFailed")),
        );
      }
      setPassword("");
      if (authMode === "register" && data.confirmationRequired) {
        setAuthMode("login");
        setNotice(t("account.confirmEmail"));
        setLoading(false);
        return;
      }
      await refreshSession();
      const claimResponse = await fetch("/api/trips/claim", { method: "POST" });
      const claim = (await claimResponse.json()) as { ok: boolean; error?: string };
      if (!claimResponse.ok || !claim.ok) {
        setError(claim.error ?? t("account.tripClaimFailed"));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("account.authenticationFailed"));
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
      if (!response.ok || !data.ok) throw new Error(data.error ?? t("account.logoutFailed"));
      await refreshSession();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("account.logoutFailed"));
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
        ) : sessionEmail && authMode !== "reset" ? (
          <div className="accountSession">
            <span>{t("account.signedInAs")}</span>
            <strong>{sessionEmail}</strong>
            <button onClick={() => void logout()} type="button">
              {t("account.signOut")}
            </button>
          </div>
        ) : (
          <form className="accountForm" onSubmit={(event) => void authenticate(event)}>
            {authMode === "login" || authMode === "register" ? (
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
            ) : null}
            {authMode === "recover" ? (
              <p className="accountFormLead">{t("account.recoveryLead")}</p>
            ) : null}
            {authMode === "reset" ? (
              <p className="accountFormLead">{t("account.resetLead")}</p>
            ) : null}
            {authMode !== "reset" ? (
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
            ) : null}
            {authMode !== "recover" ? (
              <label>
                {authMode === "reset" ? t("account.newPassword") : t("account.password")}
                <input
                  autoComplete={
                    authMode === "register" || authMode === "reset"
                      ? "new-password"
                      : "current-password"
                  }
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t("account.passwordHint")}
                  required
                  type="password"
                  value={password}
                />
              </label>
            ) : null}
            {authMode === "reset" ? (
              <label>
                {t("account.confirmPassword")}
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder={t("account.passwordHint")}
                  required
                  type="password"
                  value={passwordConfirmation}
                />
              </label>
            ) : null}
            <button disabled={loading} type="submit">
              {authMode === "register"
                ? t("account.create")
                : authMode === "recover"
                  ? t("account.sendRecovery")
                  : authMode === "reset"
                    ? t("account.updatePassword")
                    : t("account.signIn")}
            </button>
            {authMode === "login" ? (
              <button
                className="accountTextAction"
                onClick={() => chooseAuthMode("recover")}
                type="button"
              >
                {t("account.forgotPassword")}
              </button>
            ) : null}
            {authMode === "recover" ? (
              <button
                className="accountTextAction"
                onClick={() => chooseAuthMode("login")}
                type="button"
              >
                {t("account.backToSignIn")}
              </button>
            ) : null}
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
