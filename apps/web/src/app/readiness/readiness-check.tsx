"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CHINA_READINESS_ASSESSMENT_VERSION,
  CHINA_READINESS_QUESTIONS,
  ChinaReadinessSavedAssessmentSchema,
  deriveChinaReadinessResult,
  type ChinaReadinessAnswerValue,
  type ChinaReadinessQuestionId,
  type ChinaReadinessSavedAssessment,
} from "@visepanda/domain";
import { useLocale } from "../../i18n/locale-provider";

const LAST_TRIP_ID_KEY = "visepanda.lastTripId";
const ANSWER_OPTIONS: ReadonlyArray<{
  value: ChinaReadinessAnswerValue;
  label: string;
  detail: string;
}> = [
  { value: "confirmed", label: "Confirmed", detail: "I have checked this." },
  { value: "not_confirmed", label: "Not yet", detail: "I still need to do this." },
  { value: "unknown", label: "Not sure", detail: "I do not have enough information yet." },
];

type AnswerMap = Partial<Record<ChinaReadinessQuestionId, ChinaReadinessAnswerValue>>;
type SessionState = "loading" | "anonymous" | "authenticated" | "unavailable";
type SaveState = "idle" | "saving" | "saved" | "error";

type SavedResponse = { ok: true; assessment: unknown } | { ok: false; error: string };

export function ReadinessCheck() {
  const { t } = useLocale();
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [hasStarted, setHasStarted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const assessment = useMemo(
    () => ({
      version: CHINA_READINESS_ASSESSMENT_VERSION,
      answers: CHINA_READINESS_QUESTIONS.flatMap((question) => {
        const value = answers[question.id];
        return value ? [{ questionId: question.id, value }] : [];
      }),
      persistenceConsent: consent ? ("granted" as const) : ("not_requested" as const),
    }),
    [answers, consent],
  );
  const result = useMemo(() => deriveChinaReadinessResult(assessment), [assessment]);
  const resultSummary = useMemo(() => summarizeReadinessItems(result.items), [result.items]);
  const answeredCount = assessment.answers.length;
  const canPersist = session === "authenticated" || tripId !== null;

  useEffect(() => {
    const currentTripId = window.localStorage.getItem(LAST_TRIP_ID_KEY);
    setTripId(isUuid(currentTripId) ? currentTripId : null);
    void loadCurrentState(currentTripId);
  }, []);

  async function loadCurrentState(currentTripId: string | null): Promise<void> {
    try {
      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionBody = (await sessionResponse.json()) as {
        ok: boolean;
        authenticated?: boolean;
      };
      setSession(
        sessionResponse.ok && sessionBody.ok
          ? sessionBody.authenticated
            ? "authenticated"
            : "anonymous"
          : "unavailable",
      );

      if (!isUuid(currentTripId)) return;
      const response = await fetch(`/api/readiness?tripId=${encodeURIComponent(currentTripId)}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as SavedResponse;
      if (!response.ok || !body.ok || body.assessment === null) return;
      applySavedAssessment(ChinaReadinessSavedAssessmentSchema.parse(body.assessment));
    } catch {
      setSession("unavailable");
    }
  }

  function applySavedAssessment(saved: ChinaReadinessSavedAssessment): void {
    setAnswers(
      Object.fromEntries(
        saved.assessment.answers.map((answer) => [answer.questionId, answer.value]),
      ) as AnswerMap,
    );
    setHasStarted(true);
    setConsent(false);
    setSavedAt(saved.savedAt);
    setSaveState("saved");
    setSaveMessage("Your last saved self-report was loaded. Review it before saving again.");
  }

  function selectAnswer(
    questionId: ChinaReadinessQuestionId,
    value: ChinaReadinessAnswerValue,
  ): void {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setHasStarted(true);
    setSaveState("idle");
    setSaveMessage(null);
  }

  async function saveAssessment(): Promise<void> {
    if (!consent || !canPersist) return;
    setSaveState("saving");
    setSaveMessage(null);
    try {
      const response = await fetch("/api/readiness", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessment, ...(tripId ? { tripId } : {}) }),
      });
      const body = (await response.json()) as SavedResponse;
      if (!response.ok || !body.ok) {
        throw new Error(body.ok ? "Readiness could not be saved." : body.error);
      }
      const saved = ChinaReadinessSavedAssessmentSchema.parse(body.assessment);
      setSavedAt(saved.savedAt);
      setSaveState("saved");
      setSaveMessage(
        "Saved. This remains a self-report, not an externally verified travel record.",
      );
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Readiness could not be saved.");
    }
  }

  return (
    <>
      <section className="readinessHero" aria-labelledby="readiness-title">
        <div>
          <p className="pageEyebrow">{t("readiness.eyebrow")}</p>
          <h1 id="readiness-title">{t("readiness.title")}</h1>
          <p>
            A short preparation self-check for the practical parts of arriving in China. This is not
            a score, booking service, or verification of your travel arrangements.
          </p>
        </div>
        <aside className="readinessPrinciples" aria-label="How this check works">
          <span>10 fixed checks</span>
          <span>No percentage score</span>
          <span>Unknown stays unknown</span>
        </aside>
      </section>

      <section className="readinessContent" aria-label="China readiness self-check">
        <div className="readinessQuestions">
          <div className="readinessSectionHeading">
            <div>
              <p className="pageEyebrow">{t("readiness.selfReport")}</p>
              <h2>Answer only what you know.</h2>
            </div>
            <span aria-live="polite">
              {answeredCount} of {CHINA_READINESS_QUESTIONS.length} answered
            </span>
          </div>

          <ol>
            {CHINA_READINESS_QUESTIONS.map((question, index) => (
              <li key={question.id}>
                <article className="readinessQuestion">
                  <span className="readinessQuestionNumber" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="readinessQuestionCopy">
                    <p>{question.category}</p>
                    <h3>{question.prompt}</h3>
                  </div>
                  <div
                    className="readinessAnswerOptions"
                    aria-label={`Answer for ${question.prompt}`}
                  >
                    {ANSWER_OPTIONS.map((option) => (
                      <button
                        aria-pressed={answers[question.id] === option.value}
                        className={answers[question.id] === option.value ? "selected" : ""}
                        key={option.value}
                        onClick={() => selectAnswer(question.id, option.value)}
                        type="button"
                      >
                        <b>{option.label}</b>
                        <span>{option.detail}</span>
                      </button>
                    ))}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>

        <aside className="readinessResults" aria-live="polite">
          <div className="readinessResultsHeading">
            <p className="pageEyebrow">Explainable result</p>
            <h2>{t("readiness.items")}</h2>
            <p>
              {hasStarted
                ? "Each item uses your answer and a fixed VisePanda rule."
                : "Choose an answer to start. Unanswered items are shown as unknown."}
            </p>
          </div>
          <div className="readinessResultSummary" aria-label={t("readiness.items")}>
            <div className="ready">
              <span>{statusLabel("ready")}</span>
              <b>{resultSummary.ready}</b>
            </div>
            <div className="action_required">
              <span>{statusLabel("action_required")}</span>
              <b>{resultSummary.actionRequired}</b>
            </div>
            <div className="unknown">
              <span>{statusLabel("unknown")}</span>
              <b>{resultSummary.unknown}</b>
            </div>
          </div>

          {hasStarted ? (
            <ul>
              {result.items.map((item) => {
                const question = CHINA_READINESS_QUESTIONS.find(
                  (candidate) => candidate.id === item.questionId,
                );
                return (
                  <li key={item.ruleId}>
                    <details className={`readinessResult ${item.status}`}>
                      <summary>
                        <span className="readinessStatus">{statusLabel(item.status)}</span>
                        <b>{question?.prompt}</b>
                      </summary>
                      <div className="readinessResultDetail">
                        <dl>
                          <div>
                            <dt>Observed</dt>
                            <dd>{answerLabel(item.observedAnswer, !answers[item.questionId])}</dd>
                          </div>
                          <div>
                            <dt>Evidence</dt>
                            <dd>
                              {item.evidenceStatus === "self_reported"
                                ? "Self-reported"
                                : "Not provided"}
                            </dd>
                          </div>
                        </dl>
                        <p>{item.nextAction}</p>
                        <code>{item.ruleId}</code>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="readinessSave">
            <h3>{t("readiness.save")}</h3>
            <p>
              Saving is optional. We only send these fixed selections after you explicitly agree; no
              free-form travel notes are collected here.
            </p>
            {canPersist ? (
              <label>
                <input
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    setSaveState("idle");
                    setSaveMessage(null);
                  }}
                  type="checkbox"
                />
                I agree to save this fixed self-report with my current Trip or account.
              </label>
            ) : session === "loading" ? (
              <p className="readinessSaveHint" role="status">
                Checking whether saving is available.
              </p>
            ) : (
              <p className="readinessSaveHint">
                You can complete this check without saving. Create a Trip or sign in to save it.
              </p>
            )}
            {canPersist ? (
              <button
                disabled={!consent || saveState === "saving"}
                onClick={() => void saveAssessment()}
                type="button"
              >
                {saveState === "saving" ? t("readiness.saving") : t("readiness.save")}
              </button>
            ) : null}
            {savedAt ? <small>Last saved: {formatSavedAt(savedAt)}</small> : null}
            {saveMessage ? (
              <p
                className={`readinessSaveMessage ${saveState}`}
                role={saveState === "error" ? "alert" : "status"}
              >
                {saveMessage}
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </>
  );
}

export function answerLabel(answer: ChinaReadinessAnswerValue, unanswered: boolean): string {
  if (unanswered) return "Not answered (unknown)";
  return answer === "confirmed" ? "Confirmed" : answer === "not_confirmed" ? "Not yet" : "Not sure";
}

export function statusLabel(status: "ready" | "action_required" | "unknown"): string {
  if (status === "ready") return "Ready";
  if (status === "action_required") return "Action needed";
  return "Unknown";
}

export function summarizeReadinessItems(
  items: ReadonlyArray<{
    status: "ready" | "action_required" | "unknown";
  }>,
): Readonly<{ ready: number; actionRequired: number; unknown: number }> {
  return items.reduce(
    (summary, item) => {
      if (item.status === "ready") summary.ready += 1;
      else if (item.status === "action_required") summary.actionRequired += 1;
      else summary.unknown += 1;
      return summary;
    },
    { ready: 0, actionRequired: 0, unknown: 0 },
  );
}

function isUuid(value: string | null): value is string {
  return (
    value !== null &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  return Number.isNaN(date.valueOf())
    ? "just now"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
