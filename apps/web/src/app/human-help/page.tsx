"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { HumanTask } from "@visepanda/domain";

type SubmitState = "idle" | "submitting" | "sent" | "error";

export default function HumanHelpPage() {
  const [state, setState] = useState<SubmitState>("idle");
  const [task, setTask] = useState<HumanTask | null>(null);
  const [city, setCity] = useState("");
  const [kind, setKind] = useState("other");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCity(params.get("city") ?? "");
    setKind(params.get("kind") ?? "other");
    setDescription(params.get("description") ?? "");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/human-help", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        city: String(form.get("city") ?? ""),
        kind: String(form.get("kind") ?? ""),
        description: String(form.get("description") ?? ""),
        contact: String(form.get("contact") ?? ""),
      }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }

    const data = (await response.json()) as { task: HumanTask };
    setTask(data.task);
    setState("sent");
    event.currentTarget.reset();
  }

  return (
    <main className="shell humanHelp">
      <section className="hero">
        <div>
          <h1>Human Help</h1>
          <p>Ask a concierge to call, confirm, translate, or unblock a China travel task.</p>
        </div>
        <a className="status" href="/">
          Back to Copilot
        </a>
      </section>

      <section className="helpGrid">
        <form className="panel helpForm" onSubmit={(event) => void submit(event)}>
          <label>
            City
            <input
              name="city"
              onChange={(event) => setCity(event.target.value)}
              placeholder="Shanghai"
              required
              value={city}
            />
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
            {state === "submitting" ? "Sending..." : "Request manual quote"}
          </button>
          {state === "error" ? <p className="formStatus">Could not submit this request.</p> : null}
        </form>

        <aside className="panel helpAside">
          <h2>How Phase 0 works</h2>
          <p>
            We review requests manually first. If the task needs paid work, an operator prepares a
            quote and adds a Stripe payment link from ops.
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
