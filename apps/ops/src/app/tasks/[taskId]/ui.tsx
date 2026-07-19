"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  HumanTask,
  HumanTaskEvidence,
  HumanTaskEvidenceKind,
  HumanTaskStatus,
  HumanTaskTransition,
} from "@visepanda/domain";

type TaskDetailResponse = {
  ok: true;
  task: HumanTask;
  transitions: HumanTaskTransition[];
  evidence: HumanTaskEvidence[];
  evidence_writable: boolean;
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
  const [evidenceKind, setEvidenceKind] = useState<HumanTaskEvidenceKind>("outcome");
  const [evidenceContent, setEvidenceContent] = useState("");
  const [gapEvidenceId, setGapEvidenceId] = useState("");
  const [gapPattern, setGapPattern] = useState("");
  const [gapConfirmation, setGapConfirmation] = useState<string | null>(null);
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
      setGapEvidenceId(payload.evidence[0]?.id ?? "");
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

  async function appendEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoteState("saving");
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: evidenceKind, content: evidenceContent }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Evidence was not saved.");
      setEvidenceContent("");
      setNoteState("idle");
      await loadTask();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Evidence was not saved.");
      setNoteState("error");
    }
  }

  async function proposeGap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gapEvidenceId) return;
    setTransitionState("saving");
    setError(null);
    setGapConfirmation(null);
    try {
      const response = await fetch(
        `/api/tasks/${encodeURIComponent(taskId)}/evidence/${encodeURIComponent(gapEvidenceId)}/gap`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question_pattern: gapPattern }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Gap proposal was not created.");
      setGapPattern("");
      setGapConfirmation("Open knowledge-gap draft created for editorial review.");
      setTransitionState("idle");
    } catch (proposalError) {
      setError(
        proposalError instanceof Error ? proposalError.message : "Gap proposal was not created.",
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

  const {
    task,
    transitions,
    evidence,
    evidence_writable: evidenceWritable,
    allowed_transitions: allowedTransitions,
  } = detail;

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

        <section className="panel taskHistory" aria-labelledby="evidence-heading">
          <h2 id="evidence-heading">Private outcome evidence</h2>
          {evidence.length === 0 ? (
            <p className="muted">No private evidence recorded.</p>
          ) : (
            <ol>
              {evidence.map((item) => (
                <li key={item.id}>
                  <strong>{item.kind.replace("_", " ")}</strong>
                  <span>{item.content}</span>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </li>
              ))}
            </ol>
          )}
        </section>

        <form className="panel taskForm" onSubmit={(event) => void appendEvidence(event)}>
          <h2>Append private evidence</h2>
          {evidenceWritable ? (
            <>
              <label htmlFor="evidence-kind">Evidence type</label>
              <select
                id="evidence-kind"
                onChange={(event) => setEvidenceKind(event.target.value as HumanTaskEvidenceKind)}
                value={evidenceKind}
              >
                <option value="outcome">Outcome</option>
                <option value="transcript_excerpt">Redacted transcript excerpt</option>
              </select>
              <label htmlFor="evidence-content">Minimum necessary, already redacted content</label>
              <textarea
                id="evidence-content"
                maxLength={4000}
                minLength={10}
                onChange={(event) => setEvidenceContent(event.target.value)}
                required
                value={evidenceContent}
              />
              <button disabled={noteState === "saving"} type="submit">
                {noteState === "saving" ? "Saving..." : "Append evidence"}
              </button>
            </>
          ) : (
            <p className="muted">Evidence opens only after the task is done or cancelled.</p>
          )}
        </form>

        <form className="panel taskForm" onSubmit={(event) => void proposeGap(event)}>
          <h2>Propose knowledge gap</h2>
          {evidence.length === 0 ? (
            <p className="muted">Record private evidence first.</p>
          ) : (
            <>
              <label htmlFor="gap-evidence">Source evidence</label>
              <select
                id="gap-evidence"
                onChange={(event) => setGapEvidenceId(event.target.value)}
                value={gapEvidenceId}
              >
                {evidence.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.kind.replace("_", " ")} · {new Date(item.created_at).toLocaleString()}
                  </option>
                ))}
              </select>
              <label htmlFor="gap-pattern">
                Reusable question pattern, with no names or contacts
              </label>
              <textarea
                id="gap-pattern"
                maxLength={500}
                minLength={10}
                onChange={(event) => setGapPattern(event.target.value)}
                required
                value={gapPattern}
              />
              <button disabled={transitionState === "saving"} type="submit">
                {transitionState === "saving" ? "Saving..." : "Create gap draft"}
              </button>
              {gapConfirmation ? <p role="status">{gapConfirmation}</p> : null}
            </>
          )}
        </form>

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
