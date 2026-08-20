"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { WebLocale } from "../../i18n/locales";
import { LANDING_CONCERN_ORDER, type LandingCopy } from "./copy";

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "subscribed" }
  | { kind: "duplicate" }
  | { kind: "rate-limited" }
  | { kind: "saved-not-delivered" }
  | { kind: "error" };

type ApiResponse =
  { ok: true; status: "subscribed" | "already_subscribed" } | { ok: false; code?: string };

export function EarlyAccessForm({
  copy,
  locale,
}: Readonly<{ copy: LandingCopy; locale: WebLocale }>) {
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => setIsHydrated(true), []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email");
    const company = formData.get("company");
    const primaryConcern = formData.get("primaryConcern");
    if (typeof email !== "string") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          source: "landing",
          ...(typeof primaryConcern === "string" && primaryConcern ? { primaryConcern } : {}),
          ...(typeof company === "string" && company ? { company } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (payload?.ok && payload.status === "subscribed") {
        form.reset();
        setState({ kind: "subscribed" });
        return;
      }
      if (payload?.ok && payload.status === "already_subscribed") {
        setState({ kind: "duplicate" });
        return;
      }
      if (payload && !payload.ok && payload.code === "EARLY_ACCESS_RATE_LIMITED") {
        setState({ kind: "rate-limited" });
        return;
      }
      if (payload && !payload.ok && payload.code === "EARLY_ACCESS_CONFIRMATION_DELIVERY_FAILED") {
        setState({ kind: "saved-not-delivered" });
        return;
      }
      setState({ kind: "error" });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <form className="landingForm" onSubmit={onSubmit} noValidate aria-busy={!isHydrated}>
      <label htmlFor="early-access-email">{copy.form.emailLabel}</label>
      <div className="landingFormRow">
        <input
          id="early-access-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.form.emailPlaceholder}
          required
          disabled={state.kind === "submitting"}
        />
        <button type="submit" disabled={!isHydrated || state.kind === "submitting"}>
          {state.kind === "submitting" ? copy.form.submitting : copy.form.submit}
        </button>
      </div>
      <fieldset className="landingConcernFieldset" disabled={state.kind === "submitting"}>
        <legend>{copy.form.concernLegend}</legend>
        <p>{copy.form.concernHint}</p>
        <div className="landingConcernGrid">
          {LANDING_CONCERN_ORDER.map((concern) => (
            <label key={concern}>
              <input name="primaryConcern" type="radio" value={concern} />
              <span>{copy.concerns[concern]}</span>
            </label>
          ))}
        </div>
      </fieldset>
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
      <p className="landingFormNote">{copy.form.note}</p>
      {state.kind !== "idle" && state.kind !== "submitting" ? (
        <p className={`landingFormStatus ${state.kind}`} role="status" aria-live="polite">
          {formStatusMessage(state.kind, copy)}
        </p>
      ) : null}
    </form>
  );
}

export function formStatusMessage(
  kind: Exclude<FormState["kind"], "idle" | "submitting">,
  copy: LandingCopy,
): string {
  switch (kind) {
    case "subscribed":
      return copy.form.subscribed;
    case "duplicate":
      return copy.form.duplicate;
    case "rate-limited":
      return copy.form.rateLimited;
    case "saved-not-delivered":
      return copy.form.savedNotDelivered;
    case "error":
      return copy.form.unavailable;
  }
}
