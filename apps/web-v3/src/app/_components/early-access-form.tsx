"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LANDING_CONCERN_ORDER, type LandingCopy } from "../../i18n/landing-copy";
import type { WebLocale } from "../../i18n/locales";

type FormState =
  | "idle"
  | "submitting"
  | "subscribed"
  | "duplicate"
  | "rate-limited"
  | "saved-not-delivered"
  | "error";

type ApiResponse =
  { ok: true; status: "subscribed" | "already_subscribed" } | { ok: false; code?: string };

const STATUS_CLASSES: Readonly<Record<Exclude<FormState, "idle" | "submitting">, string>> = {
  subscribed: "border-brand-jade bg-brand-jade-soft text-brand-jade",
  duplicate: "border-brand-river bg-brand-river-soft text-brand-river",
  "rate-limited": "border-brand-gold bg-brand-gold-soft text-brand-gold-dark",
  "saved-not-delivered": "border-brand-gold bg-brand-gold-soft text-brand-gold-dark",
  error: "border-brand-red bg-brand-red-soft text-brand-red-hover",
};

export function EarlyAccessForm({
  copy,
  locale,
}: Readonly<{ copy: LandingCopy; locale: WebLocale }>) {
  const [state, setState] = useState<FormState>("idle");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => setIsHydrated(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = formData.get("email");
    const primaryConcern = formData.get("primaryConcern");
    const company = formData.get("company");
    if (typeof email !== "string") return;

    setState("submitting");
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
        setState("subscribed");
      } else if (payload?.ok && payload.status === "already_subscribed") {
        setState("duplicate");
      } else if (payload && !payload.ok && payload.code === "EARLY_ACCESS_RATE_LIMITED") {
        setState("rate-limited");
      } else if (
        payload &&
        !payload.ok &&
        payload.code === "EARLY_ACCESS_CONFIRMATION_DELIVERY_FAILED"
      ) {
        setState("saved-not-delivered");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  const isSubmitting = state === "submitting";

  return (
    <form
      className="mt-8 grid gap-5"
      action="/api/early-access"
      method="post"
      onSubmit={submit}
      noValidate
      aria-busy={!isHydrated || isSubmitting}
    >
      <label
        className="grid gap-2 text-sm font-semibold text-brand-ink"
        htmlFor="early-access-email"
      >
        {copy.form.emailLabel}
        <input
          id="early-access-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.form.emailPlaceholder}
          required
          disabled={isSubmitting}
          className="min-h-12 rounded-brand-sm border border-brand-line-strong bg-brand-surface px-4 text-base text-brand-ink shadow-brand-sm outline-none transition placeholder:text-brand-faint focus:border-brand-red focus:ring-2 focus:ring-brand-red-soft disabled:cursor-not-allowed disabled:bg-brand-app"
        />
      </label>

      <button
        type="submit"
        disabled={!isHydrated || isSubmitting}
        className="min-h-12 rounded-brand-sm border border-brand-red-hover bg-brand-red px-5 py-3 text-base font-bold text-brand-on-primary shadow-brand-sm transition-colors hover:bg-brand-red-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red disabled:cursor-not-allowed disabled:border-brand-line-strong disabled:bg-brand-app disabled:text-brand-muted"
      >
        {isSubmitting ? copy.form.submitting : copy.form.submit}
      </button>

      <fieldset className="grid gap-3" disabled={isSubmitting}>
        <legend className="text-base font-bold text-brand-ink">{copy.form.concernLegend}</legend>
        <p className="text-sm leading-6 text-brand-muted">{copy.form.concernHint}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {LANDING_CONCERN_ORDER.map((concern) => (
            <label key={concern} className="relative cursor-pointer">
              <input
                className="peer absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 accent-brand-red"
                name="primaryConcern"
                type="radio"
                value={concern}
              />
              <span className="flex min-h-11 items-center rounded-brand-sm border border-brand-line bg-brand-surface py-2 pe-3 ps-11 text-sm font-medium leading-5 text-brand-ink-soft transition-colors peer-checked:border-brand-red peer-checked:bg-brand-red-soft peer-checked:text-brand-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-red">
                {copy.concerns[concern]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div
        className="absolute -start-px -top-px h-px w-px overflow-hidden opacity-0"
        aria-hidden="true"
      >
        <label htmlFor="early-access-company">Company</label>
        <input
          id="early-access-company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <p className="text-sm leading-6 text-brand-muted">{copy.form.note}</p>
      {state !== "idle" && state !== "submitting" ? (
        <p
          className={`rounded-brand-sm border px-4 py-3 text-sm font-semibold leading-6 ${STATUS_CLASSES[state]}`}
          role="status"
          aria-live="polite"
        >
          {formStatusMessage(state, copy)}
        </p>
      ) : null}
    </form>
  );
}

export function formStatusMessage(
  state: Exclude<FormState, "idle" | "submitting">,
  copy: LandingCopy,
): string {
  switch (state) {
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
