"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { HumanTask, HumanTaskStatus, HumanTaskTransition } from "@visepanda/domain";

type TaskDetailResponse = {
  ok: true;
  task: HumanTask;
  transitions: HumanTaskTransition[];
  allowed_transitions: HumanTaskStatus[];
};

type LoadState = "loading" | "ready" | "error";
type MutationState = "idle" | "saving" | "error";

export function HumanTaskDetail({ taskId }: Readonly<{ taskId: string }>) {
  const [detail, setDetail] = useState<TaskDetailResponse | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [noteState, setNoteState] = useState<MutationState>("idle");
  const [transitionState, setTransitionState] = useState<MutationState>("idle");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<HumanTaskStatus | "">("");
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    setLoadState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`);
      const payload = (await response.json()) as TaskDetailResponse | { error?: string };
      if (!response.ok || !("task" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error : undefined) ?? "Human Task detail is unavailable.",
        );
      }
      setDetail(payload);
      setNote(payload.task.operator_note ?? "");
      setSelectedStatus(payload.allowed_transitions[0] ?? "");
      setLoadState("ready");
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Human Task detail is unavailable.",
      );
      setLoadState("error");
    }
  }, [taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoteState("saving");
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operator_note: note.trim() || null }),
      });
      const payload = (await response.json()) as {
        note?: string | null;
        updated_at?: string;
        error?: string;
      };
      if (!response.ok || !payload.updated_at) {
        throw new Error(payload.error ?? "Note was not saved.");
      }
      const updatedAt = payload.updated_at;
      setDetail((current) =>
        current
          ? {
              ...current,
              task: {
                ...current.task,
                operator_note: payload.note ?? null,
                updated_at: updatedAt,
              },
            }
          : current,
      );
      setNote(payload.note ?? "");
      setNoteState("idle");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Note was not saved.");
      setNoteState("error");
    }
  }

  async function transitionTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStatus) return;
    setTransitionState("saving");
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to_status: selectedStatus, reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Task status was not changed.");
      setReason("");
      setTransitionState("idle");
      await loadTask();
    } catch (transitionError) {
      setError(
        transitionError instanceof Error ? transitionError.message : "Task status was not changed.",
      );
      setTransitionState("error");
    }
  }

  if (loadState === "loading") {
    return <section className="panel empty">Loading task detail...</section>;
  }
  if (loadState === "error" || !detail) {
    return (
      <section className="panel empty" role="alert">
        <p>{error ?? "Human Task detail is unavailable."}</p>
        <button onClick={() => void loadTask()} type="button">
          Try again
        </button>
      </section>
    );
  }

  const { task, transitions, allowed_transitions: allowedTransitions } = detail;

  return (
    <div className="taskDetail">
      <section className="heading taskHeading">
        <div>
          <p className="eyebrow">Controlled preview task</p>
          <h1>{task.city} request</h1>
          <p className="muted">{task.id}</p>
        </div>
        <span className="pill">{task.status}</span>
      </section>

      {error ? (
        <p className="taskError" role="alert">
          {error}
        </p>
      ) : null}

      <div className="taskDetailGrid">
        <section className="panel taskRequest" aria-labelledby="request-heading">
          <h2 id="request-heading">Traveler request</h2>
          <dl>
            <div>
              <dt>Type</dt>
              <dd>{task.kind}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{task.contact}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(task.created_at).toLocaleString()}</dd>
            </div>
          </dl>
          <p>{task.description}</p>
        </section>

        <section className="panel taskPolicy" aria-labelledby="policy-heading">
          <h2 id="policy-heading">Preview boundary</h2>
          <p>
            Triage this request for scope, safety, capacity, and sufficient information. Do not
            promise fulfilment, quote, payment, booking, emergency, medical, legal, or account
            access support.
          </p>
        </section>

        <form className="panel taskForm" onSubmit={(event) => void saveNote(event)}>
          <h2>Internal operator note</h2>
          <label htmlFor="operator-note">Visible only to authorized Ops users</label>
          <textarea
            id="operator-note"
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Record only the minimum information needed for triage."
            value={note}
          />
          <button disabled={noteState === "saving"} type="submit">
            {noteState === "saving" ? "Saving..." : "Save note"}
          </button>
        </form>

        <section className="panel taskHistory" aria-labelledby="history-heading">
          <h2 id="history-heading">Status history</h2>
          {transitions.length === 0 ? (
            <p className="muted">No status changes recorded.</p>
          ) : (
            <ol>
              {transitions.map((transition) => (
                <li key={transition.id}>
                  <strong>
                    {transition.from_status} to {transition.to_status}
                  </strong>
                  <span>{transition.reason}</span>
                  <small>{new Date(transition.created_at).toLocaleString()}</small>
                </li>
              ))}
            </ol>
          )}
        </section>

        <form className="panel taskForm" onSubmit={(event) => void transitionTask(event)}>
          <h2>Triage decision</h2>
          {allowedTransitions.length === 0 ? (
            <p className="muted">No controlled-preview transition is available.</p>
          ) : (
            <>
              <label htmlFor="task-status">Next legal status</label>
              <select
                id="task-status"
                onChange={(event) => setSelectedStatus(event.target.value as HumanTaskStatus)}
                value={selectedStatus}
              >
                {allowedTransitions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <label htmlFor="transition-reason">Decision reason</label>
              <textarea
                id="transition-reason"
                maxLength={500}
                minLength={10}
                onChange={(event) => setReason(event.target.value)}
                required
                value={reason}
              />
              <button disabled={transitionState === "saving"} type="submit">
                {transitionState === "saving" ? "Saving..." : "Save status change"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
