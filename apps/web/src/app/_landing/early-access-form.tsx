"use client";

import { useEffect, useState, type FormEvent } from "react";

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "subscribed"; message: string }
  | { kind: "duplicate"; message: string }
  | { kind: "rate-limited"; message: string }
  | { kind: "saved-not-delivered"; message: string }
  | { kind: "error"; message: string };

type ApiResponse =
  | { ok: true; status: "subscribed" | "already_subscribed" }
  | { ok: false; code?: string; error?: string; retryAfterSeconds?: number };

export function EarlyAccessForm() {
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email");
    const company = formData.get("company");
    if (typeof email !== "string") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          locale: document.documentElement.lang || "en",
          source: "landing",
          ...(typeof company === "string" && company ? { company } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (payload?.ok && payload.status === "subscribed") {
        form.reset();
        setState({
          kind: "subscribed",
          message: "You are on the list. Check your inbox for a confirmation email.",
        });
        return;
      }
      if (payload?.ok && payload.status === "already_subscribed") {
        setState({
          kind: "duplicate",
          message: "This email is already on the Early Access list.",
        });
        return;
      }
      if (payload && !payload.ok && payload.code === "EARLY_ACCESS_RATE_LIMITED") {
        setState({
          kind: "rate-limited",
          message: "Too many attempts were sent from this network. Please try again later.",
        });
        return;
      }
      if (payload && !payload.ok && payload.code === "EARLY_ACCESS_CONFIRMATION_DELIVERY_FAILED") {
        setState({
          kind: "saved-not-delivered",
          message: "Your signup was saved, but the confirmation email could not be sent.",
        });
        return;
      }
      setState({
        kind: "error",
        message:
          payload && !payload.ok && payload.error ? payload.error : "Please try again later.",
      });
    } catch {
      setState({
        kind: "error",
        message: "We could not reach Early Access right now. Please try again later.",
      });
    }
  }

  return (
    <form className="landingForm" onSubmit={onSubmit} noValidate aria-busy={!isHydrated}>
      <label htmlFor="early-access-email">Email address</label>
      <div className="landingFormRow">
        <input
          id="early-access-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
          disabled={state.kind === "submitting"}
        />
        <button type="submit" disabled={!isHydrated || state.kind === "submitting"}>
          {state.kind === "submitting" ? "Joining..." : "Join early access"}
        </button>
      </div>
      <div className="landingHoneypot" aria-hidden="true">
        <label htmlFor="early-access-company">Company</label>
        <input
          id="early-access-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <p className="landingFormNote">We only use this for access and material preview updates.</p>
      {state.kind !== "idle" && state.kind !== "submitting" ? (
        <p className={`landingFormStatus ${state.kind}`} role="status" aria-live="polite">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
