"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { HumanTaskReceipt } from "@visepanda/domain";

type SubmitState = "idle" | "submitting" | "sent" | "error";

export default function HumanHelpPage() {
  const [state, setState] = useState<SubmitState>("idle");
  const [task, setTask] = useState<HumanTaskReceipt | null>(null);
  const [kind, setKind] = useState("other");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setKind(params.get("kind") ?? "other");
    setDescription(params.get("description") ?? "");
  }, []);

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
        setError(data.error ?? "Could not submit this request.");
        setState("error");
        return;
      }

      setTask(data.task);
      idempotencyKey.current = null;
      setKind("other");
      setDescription("");
      setState("sent");
      formElement.reset();
    } catch {
      setError("Human Help is offline. Your request was not submitted.");
      setState("error");
    }
  }

  return (
    <main className="shell humanHelp">
      <section className="hero">
        <div>
          <h1>Human Help</h1>
          <p>Submit a limited Shanghai request for manual review during the Phase 0 preview.</p>
        </div>
        <a className="status" href="/">
          Back to Copilot
        </a>
      </section>

      <section className="helpGrid">
        <form className="panel helpForm" onSubmit={(event) => void submit(event)}>
          <label>
            City
            <input name="city" readOnly required value="Shanghai" />
          </label>
          <label>
            Task type
            <select
              name="kind"
              onChange={(event) => setKind(event.target.value)}
              required
              value={kind}
            >
              <option value="call_restaurant">Call restaurant</option>
              <option value="ticket_help">Ticket help</option>
              <option value="translation_help">Translation help</option>
              <option value="transport_help">Transport help</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            What do you need?
            <textarea
              minLength={10}
              name="description"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Example: Please call this restaurant and confirm whether they can hold a table for two at 7pm."
              required
              value={description}
            />
          </label>
          <label>
            Contact
            <input name="contact" placeholder="Email or WhatsApp" required />
          </label>
          <button disabled={state === "submitting"} type="submit">
            {state === "submitting" ? "Sending..." : "Submit for manual review"}
          </button>
          {state === "error" ? <p className="formStatus">{error}</p> : null}
        </form>

        <aside className="panel helpAside">
          <h2>Preview limits</h2>
          <p>
            English requests for Shanghai are reviewed from 09:00 to 21:00 China time, with up to
            five new requests accepted per day. Requests outside those hours may wait in the queue.
          </p>
          <p>
            This is best-effort travel assistance, not emergency, medical, legal, payment, or
            account access support. Submission does not guarantee a reply, booking, price, or
            completion.
          </p>
          {task ? (
            <div className="confirmation">
              <b>Request received</b>
              <span>{task.id}</span>
              <small>Status: {task.status}</small>
            </div>
          ) : (
            <div className="confirmation mutedBox">No request submitted yet.</div>
          )}
        </aside>
      </section>
    </main>
  );
}
