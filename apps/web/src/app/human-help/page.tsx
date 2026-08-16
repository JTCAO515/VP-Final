"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { HumanTaskReceipt } from "@visepanda/domain";
import { SiteFooter, SiteHeader } from "../site-chrome";
import { captureClientTelemetry } from "../../lib/clientTelemetry";
import { useLocale } from "../../i18n/locale-provider";
import {
  selectPendingPaymentTasks,
  type PendingPaymentTask,
  type TravelerHumanTask,
} from "./paymentTasks";

type SubmitState = "idle" | "submitting" | "sent" | "error";

export default function HumanHelpPage() {
  const { t } = useLocale();
  const [state, setState] = useState<SubmitState>("idle");
  const [task, setTask] = useState<HumanTaskReceipt | null>(null);
  const [kind, setKind] = useState("other");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paymentTasks, setPaymentTasks] = useState<PendingPaymentTask[]>([]);
  const idempotencyKey = useRef<string | null>(null);
  const taskStarted = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setKind(params.get("kind") ?? "other");
    setDescription(params.get("description") ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadPendingPayments().then((tasks) => {
      if (!cancelled) setPaymentTasks(tasks);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    captureClientTelemetry({
      action: "human_help_viewed",
      entity_type: "human_help_form",
      entity_id: "shanghai-preview",
      props_jsonb: { city: "Shanghai" },
    });
  }, []);

  function markTaskStarted(): void {
    if (taskStarted.current) return;
    taskStarted.current = true;
    captureClientTelemetry({
      action: "task_started",
      entity_type: "human_help_form",
      entity_id: "shanghai-preview",
      props_jsonb: { city: "Shanghai", kind },
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setState("submitting");
    setError(null);

    const form = new FormData(formElement);
    idempotencyKey.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/human-help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          city: String(form.get("city") ?? ""),
          kind: String(form.get("kind") ?? ""),
          description: String(form.get("description") ?? ""),
          contact: String(form.get("contact") ?? ""),
          idempotency_key: idempotencyKey.current,
        }),
      });

      const data = (await response.json()) as {
        task?: HumanTaskReceipt;
        error?: string;
      };
      if (!response.ok || !data.task) {
        setError(data.error ?? t("help.submitFailed"));
        setState("error");
        return;
      }

      setTask(data.task);
      idempotencyKey.current = null;
      setKind("other");
      setDescription("");
      setState("sent");
      formElement.reset();
      void loadPendingPayments().then(setPaymentTasks);
    } catch {
      setError(t("help.offline"));
      setState("error");
    }
  }

  return (
    <main className="shell humanHelp">
      <SiteHeader active="help" contextKey="context.humanHelp" />
      <section className="hero pageHero">
        <div>
          <p className="pageEyebrow">{t("help.eyebrow")}</p>
          <h1>{t("help.title")}</h1>
          <p>{t("help.lead")}</p>
        </div>
        <a className="pageAction" href="/visepanda?context=human-help">
          {t("help.back")}
        </a>
      </section>

      <section className="helpGrid">
        <form
          className="panel helpForm"
          onFocusCapture={markTaskStarted}
          onSubmit={(event) => void submit(event)}
        >
          <label>
            {t("help.city")}
            <input name="city" readOnly required value="Shanghai" />
          </label>
          <label>
            {t("help.taskType")}
            <select
              name="kind"
              onChange={(event) => setKind(event.target.value)}
              required
              value={kind}
            >
              <option value="call_restaurant">{t("help.callRestaurant")}</option>
              <option value="ticket_help">{t("help.ticket")}</option>
              <option value="translation_help">{t("help.translation")}</option>
              <option value="transport_help">{t("help.transport")}</option>
              <option value="other">{t("help.other")}</option>
            </select>
          </label>
          <label>
            {t("help.whatNeed")}
            <textarea
              minLength={10}
              name="description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("help.descriptionPlaceholder")}
              required
              value={description}
            />
          </label>
          <label>
            {t("help.contact")}
            <input name="contact" placeholder={t("help.contactPlaceholder")} required />
          </label>
          <button disabled={state === "submitting"} type="submit">
            {state === "submitting" ? t("help.sending") : t("help.submit")}
          </button>
          {state === "error" ? <p className="formStatus">{error}</p> : null}
        </form>

        <aside className="panel helpAside">
          <h2>{t("help.previewLimits")}</h2>
          <p>
            English requests for Shanghai are reviewed from 09:00 to 21:00 China time, with up to
            five new requests accepted per day. Requests outside those hours may wait in the queue.
          </p>
          <p>
            This is best-effort travel assistance, not emergency, medical, legal, payment, or
            account access support. Submission does not guarantee a reply, booking, price, or
            completion.
          </p>
          <nav aria-label="Human Help policies" className="helpPolicyLinks">
            <a href="/human-help-disclaimer">{t("help.readLimits")}</a>
            <a href="/emergency-disclaimer">{t("help.emergency")}</a>
          </nav>
          {task ? (
            <div className="confirmation">
              <b>{t("help.received")}</b>
              <span>{task.id}</span>
              <small>Status: {task.status}</small>
            </div>
          ) : (
            <div className="confirmation mutedBox">{t("help.none")}</div>
          )}
          {paymentTasks.map((paymentTask) => (
            <section className="confirmation" key={paymentTask.id}>
              <b>Payment request ready</b>
              <span>USD {paymentTask.price_usd.toFixed(2)}</span>
              <a href={paymentTask.payment_link} rel="noreferrer">
                Review secure payment
              </a>
              <small>Payment is not marked received until the provider confirms it.</small>
            </section>
          ))}
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}

async function loadPendingPayments(): Promise<PendingPaymentTask[]> {
  try {
    const response = await fetch("/api/human-help/tasks", { cache: "no-store" });
    const data = (await response.json()) as { tasks?: TravelerHumanTask[] };
    if (!response.ok || !data.tasks) return [];
    return selectPendingPaymentTasks(data.tasks);
  } catch {
    return [];
  }
}
