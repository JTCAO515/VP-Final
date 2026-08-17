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
import { messageFor, type MessageKey } from "../../i18n/messages";

const LAST_TRIP_ID_KEY = "visepanda.lastTripId";
type Translate = (key: MessageKey) => string;

function answerOptions(t: Translate): ReadonlyArray<{
  value: ChinaReadinessAnswerValue;
  label: string;
  detail: string;
}> {
  return [
    {
      value: "confirmed",
      label: t("readiness.answer.confirmed"),
      detail: t("readiness.answer.confirmedDetail"),
    },
    {
      value: "not_confirmed",
      label: t("readiness.answer.notConfirmed"),
      detail: t("readiness.answer.notConfirmedDetail"),
    },
    {
      value: "unknown",
      label: t("readiness.answer.unknown"),
      detail: t("readiness.answer.unknownDetail"),
    },
  ];
}

type AnswerMap = Partial<Record<ChinaReadinessQuestionId, ChinaReadinessAnswerValue>>;
type SessionState = "loading" | "anonymous" | "authenticated" | "unavailable";
type SaveState = "idle" | "saving" | "saved" | "error";

type SavedResponse = { ok: true; assessment: unknown } | { ok: false; error: string };

export function ReadinessCheck() {
  const { locale, t } = useLocale();
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
  const localizedAnswerOptions = useMemo(() => answerOptions(t), [t]);

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
    setSaveMessage(t("readiness.loaded"));
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
        throw new Error(body.ok ? t("readiness.saveError") : body.error);
      }
      const saved = ChinaReadinessSavedAssessmentSchema.parse(body.assessment);
      setSavedAt(saved.savedAt);
      setSaveState("saved");
      setSaveMessage(t("readiness.saved"));
    } catch {
      setSaveState("error");
      setSaveMessage(t("readiness.saveError"));
    }
  }

  return (
    <>
      <section className="readinessHero" aria-labelledby="readiness-title">
        <div>
          <p className="pageEyebrow">{t("readiness.eyebrow")}</p>
          <h1 id="readiness-title">{t("readiness.title")}</h1>
          <p>{t("readiness.lead")}</p>
        </div>
        <aside className="readinessPrinciples" aria-label={t("readiness.howWorks")}>
          <span>{t("readiness.fixedChecks")}</span>
          <span>{t("readiness.noScore")}</span>
          <span>{t("readiness.unknownStaysUnknown")}</span>
        </aside>
      </section>

      <section className="readinessContent" aria-label={t("readiness.title")}>
        <div className="readinessQuestions">
          <div className="readinessSectionHeading">
            <div>
              <p className="pageEyebrow">{t("readiness.selfReport")}</p>
              <h2>{t("readiness.answerKnown")}</h2>
            </div>
            <span aria-live="polite">
              {formatTemplate(t("readiness.answered"), {
                answered: answeredCount,
                total: CHINA_READINESS_QUESTIONS.length,
              })}
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
                    aria-label={formatTemplate(t("readiness.answerFor"), {
                      question: question.prompt,
                    })}
                  >
                    {localizedAnswerOptions.map((option) => (
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
            <p className="pageEyebrow">{t("readiness.result.explainable")}</p>
            <h2>{t("readiness.items")}</h2>
            <p>{hasStarted ? t("readiness.result.started") : t("readiness.result.initial")}</p>
          </div>
          <div className="readinessResultSummary" aria-label={t("readiness.items")}>
            <div className="ready">
              <span>{statusLabel("ready", t)}</span>
              <b>{resultSummary.ready}</b>
            </div>
            <div className="action_required">
              <span>{statusLabel("action_required", t)}</span>
              <b>{resultSummary.actionRequired}</b>
            </div>
            <div className="unknown">
              <span>{statusLabel("unknown", t)}</span>
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
                        <span className="readinessStatus">{statusLabel(item.status, t)}</span>
                        <b>{question?.prompt}</b>
                      </summary>
                      <div className="readinessResultDetail">
                        <dl>
                          <div>
                            <dt>{t("readiness.observed")}</dt>
                            <dd>
                              {answerLabel(item.observedAnswer, !answers[item.questionId], t)}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("readiness.evidence")}</dt>
                            <dd>
                              {item.evidenceStatus === "self_reported"
                                ? t("readiness.selfReported")
                                : t("readiness.notProvided")}
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
            <p>{t("readiness.saveLead")}</p>
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
                {t("readiness.saveConsent")}
              </label>
            ) : session === "loading" ? (
              <p className="readinessSaveHint" role="status">
                {t("readiness.checkingAvailability")}
              </p>
            ) : (
              <p className="readinessSaveHint">{t("readiness.saveUnavailable")}</p>
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
            {savedAt ? (
              <small>
                {formatTemplate(t("readiness.lastSaved"), {
                  date: formatSavedAt(savedAt, locale, t),
                })}
              </small>
            ) : null}
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

export function answerLabel(
  answer: ChinaReadinessAnswerValue,
  unanswered: boolean,
  t: Translate = (key) => messageFor("en", key),
): string {
  if (unanswered) return t("readiness.notAnswered");
  return answer === "confirmed"
    ? t("readiness.answer.confirmed")
    : answer === "not_confirmed"
      ? t("readiness.answer.notConfirmed")
      : t("readiness.answer.unknown");
}

export function statusLabel(
  status: "ready" | "action_required" | "unknown",
  t: Translate = (key) => messageFor("en", key),
): string {
  if (status === "ready") return t("readiness.status.ready");
  if (status === "action_required") return t("readiness.status.actionRequired");
  return t("readiness.status.unknown");
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

function formatSavedAt(savedAt: string, locale: string, t: Translate): string {
  const date = new Date(savedAt);
  return Number.isNaN(date.valueOf())
    ? t("readiness.justNow")
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatTemplate(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}
