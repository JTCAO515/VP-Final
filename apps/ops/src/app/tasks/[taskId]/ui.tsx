"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  HumanTask,
  HumanTaskEvidence,
  HumanTaskEvidenceKind,
  HumanTaskStatus,
  HumanTaskTransition,
} from "@visepanda/domain";
import { displayHumanTaskEvidenceKind, displayLifecycleValue } from "../../../lib/presentation";

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
        throw new Error("人工协助任务详情暂不可用。");
      }
      setDetail(payload);
      setNote(payload.task.operator_note ?? "");
      setSelectedStatus(payload.allowed_transitions[0] ?? "");
      setGapEvidenceId(payload.evidence[0]?.id ?? "");
      setLoadState("ready");
    } catch (loadError) {
      setError("人工协助任务详情暂不可用。");
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
        throw new Error("备注未保存。");
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
      setError("备注未保存，请稍后重试。");
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
      if (!response.ok) throw new Error("任务状态未更改。");
      setReason("");
      setTransitionState("idle");
      await loadTask();
    } catch (transitionError) {
      setError("任务状态未更改，请稍后重试。");
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
      if (!response.ok) throw new Error("证据未保存。");
      setEvidenceContent("");
      setNoteState("idle");
      await loadTask();
    } catch (saveError) {
      setError("证据未保存，请稍后重试。");
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
      if (!response.ok) throw new Error("知识缺口草稿未创建。");
      setGapPattern("");
      setGapConfirmation("已创建待处理知识缺口草稿，等待编辑审核。 ");
      setTransitionState("idle");
    } catch (proposalError) {
      setError("知识缺口草稿未创建，请稍后重试。");
      setTransitionState("error");
    }
  }

  if (loadState === "loading") {
    return <section className="panel empty">正在加载任务详情…</section>;
  }
  if (loadState === "error" || !detail) {
    return (
      <section className="panel empty" role="alert">
        <p>{error ?? "人工协助任务详情暂不可用。"}</p>
        <button onClick={() => void loadTask()} type="button">
          重试
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
          <p className="eyebrow">受控预览任务</p>
          <h1>{task.city} 请求</h1>
          <p className="muted">{task.id}</p>
        </div>
        <span className="pill">{displayLifecycleValue(task.status)}</span>
      </section>

      {error ? (
        <p className="taskError" role="alert">
          {error}
        </p>
      ) : null}

      <div className="taskDetailGrid">
        <section className="panel taskRequest" aria-labelledby="request-heading">
          <h2 id="request-heading">旅行者请求</h2>
          <dl>
            <div>
              <dt>类型</dt>
              <dd>{task.kind}</dd>
            </div>
            <div>
              <dt>联系方式</dt>
              <dd>{task.contact}</dd>
            </div>
            <div>
              <dt>提交时间</dt>
              <dd>{new Date(task.created_at).toLocaleString()}</dd>
            </div>
          </dl>
          <p>{task.description}</p>
        </section>

        <section className="panel taskPolicy" aria-labelledby="policy-heading">
          <h2 id="policy-heading">预览边界</h2>
          <p>
            请从范围、安全性、服务能力和信息充分性方面分诊此请求。不得承诺履约、报价、支付、预订、紧急、医疗、法律或账号访问支持。
          </p>
        </section>

        <form className="panel taskForm" onSubmit={(event) => void saveNote(event)}>
          <h2>内部运营备注</h2>
          <label htmlFor="operator-note">仅授权的运营用户可见</label>
          <textarea
            id="operator-note"
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="仅记录分诊所需的最少信息。"
            value={note}
          />
          <button disabled={noteState === "saving"} type="submit">
            {noteState === "saving" ? "保存中…" : "保存备注"}
          </button>
        </form>

        <section className="panel taskHistory" aria-labelledby="history-heading">
          <h2 id="history-heading">状态历史</h2>
          {transitions.length === 0 ? (
            <p className="muted">尚未记录状态变更。</p>
          ) : (
            <ol>
              {transitions.map((transition) => (
                <li key={transition.id}>
                  <strong>
                    {displayLifecycleValue(transition.from_status)} 至{" "}
                    {displayLifecycleValue(transition.to_status)}
                  </strong>
                  <span>{transition.reason}</span>
                  <small>{new Date(transition.created_at).toLocaleString()}</small>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="panel taskHistory" aria-labelledby="evidence-heading">
          <h2 id="evidence-heading">私有结果证据</h2>
          {evidence.length === 0 ? (
            <p className="muted">尚未记录私有证据。</p>
          ) : (
            <ol>
              {evidence.map((item) => (
                <li key={item.id}>
                  <strong>{displayHumanTaskEvidenceKind(item.kind)}</strong>
                  <span>{item.content}</span>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                </li>
              ))}
            </ol>
          )}
        </section>

        <form className="panel taskForm" onSubmit={(event) => void appendEvidence(event)}>
          <h2>追加私有证据</h2>
          {evidenceWritable ? (
            <>
              <label htmlFor="evidence-kind">证据类型</label>
              <select
                id="evidence-kind"
                onChange={(event) => setEvidenceKind(event.target.value as HumanTaskEvidenceKind)}
                value={evidenceKind}
              >
                <option value="outcome">结果</option>
                <option value="transcript_excerpt">已脱敏的对话摘录</option>
              </select>
              <label htmlFor="evidence-content">最小必要且已脱敏的内容</label>
              <textarea
                id="evidence-content"
                maxLength={4000}
                minLength={10}
                onChange={(event) => setEvidenceContent(event.target.value)}
                required
                value={evidenceContent}
              />
              <button disabled={noteState === "saving"} type="submit">
                {noteState === "saving" ? "保存中…" : "追加证据"}
              </button>
            </>
          ) : (
            <p className="muted">仅当任务完成或取消后才可记录证据。</p>
          )}
        </form>

        <form className="panel taskForm" onSubmit={(event) => void proposeGap(event)}>
          <h2>提出知识缺口</h2>
          {evidence.length === 0 ? (
            <p className="muted">请先记录私有证据。</p>
          ) : (
            <>
              <label htmlFor="gap-evidence">来源证据</label>
              <select
                id="gap-evidence"
                onChange={(event) => setGapEvidenceId(event.target.value)}
                value={gapEvidenceId}
              >
                {evidence.map((item) => (
                  <option key={item.id} value={item.id}>
                    {displayEvidenceKind(item.kind)} · {new Date(item.created_at).toLocaleString()}
                  </option>
                ))}
              </select>
              <label htmlFor="gap-pattern">可复用的问题模式，不包含姓名或联系方式</label>
              <textarea
                id="gap-pattern"
                maxLength={500}
                minLength={10}
                onChange={(event) => setGapPattern(event.target.value)}
                required
                value={gapPattern}
              />
              <button disabled={transitionState === "saving"} type="submit">
                {transitionState === "saving" ? "保存中…" : "创建知识缺口草稿"}
              </button>
              {gapConfirmation ? <p role="status">{gapConfirmation}</p> : null}
            </>
          )}
        </form>

        <form className="panel taskForm" onSubmit={(event) => void transitionTask(event)}>
          <h2>分诊决策</h2>
          {allowedTransitions.length === 0 ? (
            <p className="muted">没有可用的受控预览状态变更。</p>
          ) : (
            <>
              <label htmlFor="task-status">下一合法状态</label>
              <select
                id="task-status"
                onChange={(event) => setSelectedStatus(event.target.value as HumanTaskStatus)}
                value={selectedStatus}
              >
                {allowedTransitions.map((status) => (
                  <option key={status} value={status}>
                    {displayLifecycleValue(status)}
                  </option>
                ))}
              </select>
              <label htmlFor="transition-reason">决策原因</label>
              <textarea
                id="transition-reason"
                maxLength={500}
                minLength={10}
                onChange={(event) => setReason(event.target.value)}
                required
                value={reason}
              />
              <button disabled={transitionState === "saving"} type="submit">
                {transitionState === "saving" ? "保存中…" : "保存状态变更"}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

function displayEvidenceKind(kind: HumanTaskEvidenceKind): string {
  return kind === "outcome" ? "结果" : "已脱敏的对话摘录";
}
