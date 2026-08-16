"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PoiCategorySchema,
  PoiFactSourceClassSchema,
  PoiLocalPresentationFactTypeSchema,
  type Poi,
  type PoiCategory,
  type PoiFactSourceClass,
  type PoiLocalPresentationFactType,
  type PoiFact,
  type DraftFactReviewQueueItem,
} from "@visepanda/domain";

type SaveState = "idle" | "saving" | "saved" | "error";

export function FactEditor() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [genericFactMessage, setGenericFactMessage] = useState<string | null>(null);

  async function loadPois() {
    const response = await fetch(
      "/api/knowledge/pois?includeDrafts=1&includeExpired=1&includeDeprecated=1",
    );
    setPois((await response.json()) as Poi[]);
  }

  useEffect(() => {
    void loadPois();
  }, []);

  const rows = useMemo(
    () =>
      pois.flatMap((poi) =>
        poi.facts.map((fact) => {
          const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(fact.factType);
          return {
            fact,
            poi,
            localFactType: localFactType.success ? localFactType.data : null,
            label: factDisplayValue(fact),
          };
        }),
      ),
    [pois],
  );

  async function saveFact(fact: PoiFact) {
    setSaveState("saving");
    const saved = await persistDraft(fact);
    setSaveState(saved ? "saved" : "error");
  }

  async function persistDraft(fact: PoiFact): Promise<boolean> {
    const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(fact.factType);
    const value = document.getElementById(factValueInputId(fact, localFactType.success)) as
      HTMLInputElement | HTMLTextAreaElement | null;
    const sourceClass = document.getElementById(
      `source-class-${fact.id}`,
    ) as HTMLSelectElement | null;
    const sourceLocator = document.getElementById(
      `source-locator-${fact.id}`,
    ) as HTMLInputElement | null;
    const evidenceSummary = document.getElementById(
      `evidence-summary-${fact.id}`,
    ) as HTMLInputElement | null;
    const confidence = document.getElementById(`confidence-${fact.id}`) as HTMLInputElement | null;
    if (
      !value ||
      !sourceClass?.value ||
      !sourceLocator?.value.trim() ||
      !evidenceSummary?.value.trim() ||
      !confidence
    ) {
      return false;
    }

    const response = await fetch("/api/knowledge/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        factId: fact.id,
        value: localFactType.success ? { text: value.value } : { label: value.value },
        sourceClass: sourceClass.value,
        sourceLocator: sourceLocator.value,
        evidenceSummary: evidenceSummary.value,
        confidence: Number(confidence.value),
      }),
    });

    if (!response.ok) {
      return false;
    }

    setPois((await response.json()) as Poi[]);
    return true;
  }

  async function createFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    const form = new FormData(event.currentTarget);
    const factType = String(form.get("factType") ?? "");
    if (PoiLocalPresentationFactTypeSchema.safeParse(factType).success) {
      setGenericFactMessage(
        "Use the Show-to-Local facts form for this independently sourced field.",
      );
      setSaveState("error");
      return;
    }
    const response = await fetch("/api/knowledge/facts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        poiId: String(form.get("poiId") ?? ""),
        factType,
        value: { label: String(form.get("label") ?? "") },
        sourceClass: String(form.get("sourceClass") ?? ""),
        sourceLocator: String(form.get("sourceLocator") ?? ""),
        evidenceSummary: String(form.get("evidenceSummary") ?? ""),
        confidence: Number(form.get("confidence") ?? 0),
      }),
    });
    if (!response.ok) {
      setGenericFactMessage("Fact draft could not be saved.");
      setSaveState("error");
      return;
    }
    event.currentTarget.reset();
    await loadPois();
    setGenericFactMessage(null);
    setSaveState("saved");
  }

  return (
    <div className="factWorkspace">
      <DraftFactReviewQueue pois={pois} />
      <section className="panel">
        <PoiEditor pois={pois} onChanged={loadPois} />
        <LocalPresentationFactEditor pois={pois} onChanged={loadPois} />
        <h2>Other fact drafts</h2>
        <form className="inlineForm" onSubmit={(event) => void createFact(event)}>
          <select name="poiId" required>
            <option value="">Choose POI</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
          <input name="factType" placeholder="fact type" required />
          <input name="label" placeholder="short label" required />
          <input
            max="1"
            min="0"
            name="confidence"
            placeholder="0.9"
            required
            step="0.05"
            type="number"
          />
          <SourceClassSelect name="sourceClass" />
          <input name="sourceLocator" placeholder="source URL or evidence reference" required />
          <input
            maxLength={240}
            name="evidenceSummary"
            placeholder="what this source supports (no PII)"
            required
          />
          <button disabled={saveState === "saving"} type="submit">
            Add fact
          </button>
        </form>
        {genericFactMessage ? <p className="danger">{genericFactMessage}</p> : null}
        {rows.length === 0 ? (
          <p className="empty">No facts loaded.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>City</th>
                <th>POI</th>
                <th>Fact</th>
                <th>Value</th>
                <th>Version</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ fact, label, localFactType, poi }) => (
                <tr key={fact.id}>
                  <td>{poi.city}</td>
                  <td>
                    <strong>{poi.nameEn}</strong>
                    <br />
                    <small>{poi.category}</small>
                  </td>
                  <td>
                    <span className="pill">{fact.factType}</span>
                    <br />
                    <small>{fact.status}</small>
                    {fact.expiresAt && Date.parse(fact.expiresAt) < Date.now() ? (
                      <>
                        <br />
                        <small className="danger">expired</small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {localFactType ? (
                      <>
                        {localFactType === "local_address_zh" ? (
                          <small className="danger">
                            Real-world address: verify against the cited source before review.
                          </small>
                        ) : null}
                        <textarea
                          aria-label={`${fact.id} local-display text`}
                          defaultValue={label}
                          id={factValueInputId(fact, true)}
                          maxLength={500}
                        />
                      </>
                    ) : (
                      <input
                        aria-label={`${fact.id} value`}
                        defaultValue={label}
                        id={factValueInputId(fact, false)}
                      />
                    )}
                    <input
                      aria-label={`${fact.id} source locator`}
                      defaultValue={fact.sourceLocator ?? ""}
                      id={`source-locator-${fact.id}`}
                    />
                    <SourceClassSelect
                      ariaLabel={`${fact.id} source class`}
                      defaultValue={fact.sourceClass ?? ""}
                      id={`source-class-${fact.id}`}
                    />
                    <input
                      aria-label={`${fact.id} evidence summary`}
                      defaultValue={fact.evidenceSummary ?? ""}
                      id={`evidence-summary-${fact.id}`}
                      maxLength={240}
                    />
                    <input
                      aria-label={`${fact.id} confidence`}
                      defaultValue={fact.confidence}
                      id={`confidence-${fact.id}`}
                      max="1"
                      min="0"
                      step="0.05"
                      type="number"
                    />
                  </td>
                  <td>{fact.version}</td>
                  <td>
                    <div className="rowActions">
                      <button
                        disabled={saveState === "saving"}
                        onClick={() => void saveFact(fact)}
                        type="button"
                      >
                        Save
                      </button>
                      {fact.status === "draft" ? (
                        <small>
                          Use the per-item review queue before this draft can be reviewed.
                        </small>
                      ) : null}
                      <small>
                        {fact.verifiedAt
                          ? `verified ${fact.verifiedAt.slice(0, 10)}`
                          : "unverified"}
                      </small>
                      {saveState !== "idle" ? <small>{saveState}</small> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

type DraftReviewAction = "approve" | "reject";

type DraftReviewFilters = {
  poiId: string;
  factType: string;
  importBatchId: string;
};

const EMPTY_DRAFT_REVIEW_FILTERS: DraftReviewFilters = {
  poiId: "",
  factType: "",
  importBatchId: "",
};

function DraftFactReviewQueue({ pois }: { pois: Poi[] }) {
  const [items, setItems] = useState<DraftFactReviewQueueItem[]>([]);
  const [filters, setFilters] = useState<DraftReviewFilters>(EMPTY_DRAFT_REVIEW_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DraftReviewFilters>(
    EMPTY_DRAFT_REVIEW_FILTERS,
  );
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("Loading drafts that still need a human decision.");
  const [pendingAction, setPendingAction] = useState<{
    factId: string;
    action: DraftReviewAction;
  } | null>(null);

  async function load(nextFilters = appliedFilters) {
    setState("saving");
    const params = new URLSearchParams();
    if (nextFilters.poiId) params.set("poiId", nextFilters.poiId);
    if (nextFilters.factType.trim()) params.set("factType", nextFilters.factType.trim());
    if (nextFilters.importBatchId.trim()) {
      params.set("importBatchId", nextFilters.importBatchId.trim());
    }
    try {
      const response = await fetch(`/api/knowledge/facts/review-queue?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        items?: DraftFactReviewQueueItem[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.items) {
        throw new Error(payload?.error ?? "Draft review queue is unavailable.");
      }
      setItems(payload.items);
      setState("idle");
      setMessage(
        payload.items.length === 0
          ? "No draft facts match these filters. Nothing has been approved or hidden."
          : `${payload.items.length} draft fact${payload.items.length === 1 ? "" : "s"} need an individual decision.`,
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Draft review queue is unavailable.");
    }
  }

  useEffect(() => {
    void load(EMPTY_DRAFT_REVIEW_FILTERS);
  }, []);

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
    await load(filters);
  }

  async function applyAction(factId: string, action: DraftReviewAction, expectedVersion: number) {
    setState("saving");
    setMessage(action === "approve" ? "Recording this review…" : "Rejecting this draft…");
    try {
      const response = await fetch("/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? { factId, action: "approve_draft", expectedVersion }
            : { factId, action: "reject" },
        ),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        throw new Error(payload?.error ?? "This draft could not be updated.");
      }
      setPendingAction(null);
      await load(appliedFilters);
      setMessage(
        action === "approve"
          ? "One draft was reviewed. It is now eligible only while its evidence remains current."
          : "One draft was rejected. It remains unavailable to traveler-facing surfaces.",
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "This draft could not be updated.");
    }
  }

  async function saveCorrection(fact: PoiFact, form: FormData): Promise<boolean> {
    const value = String(form.get("value") ?? "").trim();
    const sourceClass = String(form.get("sourceClass") ?? "");
    const sourceLocator = String(form.get("sourceLocator") ?? "").trim();
    const evidenceSummary = String(form.get("evidenceSummary") ?? "").trim();
    const confidence = Number(form.get("confidence") ?? NaN);
    const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(fact.factType);
    if (
      !value ||
      !sourceClass ||
      !sourceLocator ||
      !evidenceSummary ||
      !Number.isFinite(confidence)
    ) {
      setState("error");
      setMessage("Correct the value, source, evidence summary, and confidence before saving.");
      return false;
    }

    setState("saving");
    try {
      const response = await fetch("/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          factId: fact.id,
          value: localFactType.success ? { text: value } : { label: value },
          sourceClass,
          sourceLocator,
          evidenceSummary,
          confidence,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        throw new Error(payload?.error ?? "This draft correction could not be saved.");
      }
      await load(appliedFilters);
      setMessage("Correction saved as a draft. Review it again, then confirm approval separately.");
      return true;
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "This draft correction could not be saved.",
      );
      return false;
    }
  }

  return (
    <section className="panel draftReviewQueue" aria-labelledby="draft-review-title">
      <div className="draftReviewHeading">
        <div>
          <p className="eyebrow">Human review only</p>
          <h2 id="draft-review-title">Draft fact review queue</h2>
          <p className="muted">
            Each action applies to exactly one draft. Imported or model-authored content stays a
            draft until a person checks its evidence and confirms the decision here.
          </p>
        </div>
        <button
          className="secondaryButton"
          disabled={state === "saving"}
          onClick={() => void load(appliedFilters)}
          type="button"
        >
          Refresh queue
        </button>
      </div>

      <form className="filters" onSubmit={(event) => void submitFilters(event)}>
        <label>
          POI
          <select
            onChange={(event) => setFilters({ ...filters, poiId: event.target.value })}
            value={filters.poiId}
          >
            <option value="">All POIs</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fact type
          <input
            list="draft-fact-types"
            onChange={(event) => setFilters({ ...filters, factType: event.target.value })}
            placeholder="local_address_zh"
            value={filters.factType}
          />
          <datalist id="draft-fact-types">
            {[...new Set(items.map((item) => item.draft.factType))].sort().map((factType) => (
              <option key={factType} value={factType} />
            ))}
          </datalist>
        </label>
        <label>
          Import batch
          <input
            onChange={(event) => setFilters({ ...filters, importBatchId: event.target.value })}
            placeholder="batch UUID or legacy-unbatched"
            value={filters.importBatchId}
          />
        </label>
        <div className="rowActions">
          <button disabled={state === "saving"} type="submit">
            Apply filters
          </button>
          <button
            className="secondaryButton"
            disabled={state === "saving"}
            onClick={() => {
              setFilters(EMPTY_DRAFT_REVIEW_FILTERS);
              setAppliedFilters(EMPTY_DRAFT_REVIEW_FILTERS);
              void load(EMPTY_DRAFT_REVIEW_FILTERS);
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
      </form>

      <p className={state === "error" ? "taskError" : "muted"} role="status">
        {message}
      </p>
      {items.length > 0 ? (
        <div className="draftReviewList">
          {items.map((item) => (
            <DraftFactReviewCard
              actionPending={
                pendingAction?.factId === item.draft.id ? pendingAction.action : undefined
              }
              busy={state === "saving"}
              item={item}
              key={`${item.draft.id}-${item.draft.version}`}
              onCancelAction={() => setPendingAction(null)}
              onConfirmAction={(action) =>
                void applyAction(item.draft.id, action, item.draft.version)
              }
              onProposeAction={(action) => setPendingAction({ factId: item.draft.id, action })}
              onSaveCorrection={saveCorrection}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function DraftFactReviewCard({
  actionPending,
  busy,
  item,
  onCancelAction,
  onConfirmAction,
  onProposeAction,
  onSaveCorrection,
}: {
  actionPending: DraftReviewAction | undefined;
  busy: boolean;
  item: DraftFactReviewQueueItem;
  onCancelAction: () => void;
  onConfirmAction: (action: DraftReviewAction) => void;
  onProposeAction: (action: DraftReviewAction) => void;
  onSaveCorrection: (fact: PoiFact, form: FormData) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(item.draft.factType);
  const value = factDisplayValue(item.draft);
  const cardTitleId = `draft-review-${item.draft.id}`;

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSaveCorrection(item.draft, new FormData(event.currentTarget))) setEditing(false);
  }

  return (
    <article className="draftReviewItem" aria-labelledby={cardTitleId}>
      <header>
        <div>
          <p className="eyebrow">Draft · {item.poi.city}</p>
          <h3 id={cardTitleId}>{item.poi.nameEn}</h3>
          <p className="muted">
            {item.poi.nameZh ? `${item.poi.nameZh} · ` : ""}
            {item.poi.category} · version {item.draft.version}
          </p>
        </div>
        <span className="pill">{item.draft.factType}</span>
      </header>

      {item.draft.factType === "local_address_zh" ? (
        <p className="taskError">
          This Chinese address may be shown to a real stranger. Verify it against the cited source
          before any approval.
        </p>
      ) : null}

      <dl className="draftFactDetails">
        <div>
          <dt>Draft value</dt>
          <dd>{value}</dd>
        </div>
        <div>
          <dt>Source class</dt>
          <dd>
            {item.draft.sourceClass
              ? SOURCE_CLASS_LABELS[item.draft.sourceClass]
              : "Missing source class"}
          </dd>
        </div>
        <div>
          <dt>Source locator</dt>
          <dd>{item.draft.sourceLocator}</dd>
        </div>
        <div>
          <dt>Evidence summary</dt>
          <dd>{item.draft.evidenceSummary}</dd>
        </div>
        <div>
          <dt>Import context</dt>
          <dd>
            {item.importContext
              ? `${item.importContext.importBatchId ?? "legacy-unbatched"} · ${item.importContext.collectionRowId} · ${item.importContext.collectionStatus}`
              : "Not imported through a recorded batch."}
          </dd>
        </div>
      </dl>

      <section className="reviewedSiblings" aria-label={`Reviewed facts for ${item.poi.nameEn}`}>
        <h4>Other reviewed facts at this POI</h4>
        {item.reviewedSiblings.length === 0 ? (
          <p className="muted">No other reviewed facts are available for comparison.</p>
        ) : (
          <ul>
            {item.reviewedSiblings.map((sibling) => (
              <li key={sibling.id}>
                <strong>{sibling.factType}</strong> · {factDisplayValue(sibling)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <form className="reviewCorrectionForm" onSubmit={(event) => void saveCorrection(event)}>
          <h4>Correct this draft before approval</h4>
          <label>
            Value
            {localFactType.success ? (
              <textarea defaultValue={value} maxLength={500} name="value" required />
            ) : (
              <input defaultValue={value} name="value" required />
            )}
          </label>
          <label>
            Source class
            <SourceClassSelect defaultValue={item.draft.sourceClass ?? ""} name="sourceClass" />
          </label>
          <label>
            Source locator
            <input
              defaultValue={item.draft.sourceLocator ?? ""}
              maxLength={500}
              name="sourceLocator"
              required
            />
          </label>
          <label>
            Evidence summary
            <input
              defaultValue={item.draft.evidenceSummary ?? ""}
              maxLength={240}
              name="evidenceSummary"
              required
            />
          </label>
          <label>
            Confidence
            <input
              defaultValue={item.draft.confidence}
              max="1"
              min="0"
              name="confidence"
              required
              step="0.05"
              type="number"
            />
          </label>
          <div className="rowActions">
            <button disabled={busy} type="submit">
              Save correction as draft
            </button>
            <button
              className="secondaryButton"
              disabled={busy}
              onClick={() => setEditing(false)}
              type="button"
            >
              Cancel correction
            </button>
          </div>
        </form>
      ) : null}

      {!editing && !actionPending ? (
        <div className="rowActions">
          <button disabled={busy} onClick={() => onProposeAction("approve")} type="button">
            Approve this draft
          </button>
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={() => setEditing(true)}
            type="button"
          >
            Correct before approval
          </button>
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={() => onProposeAction("reject")}
            type="button"
          >
            Reject this draft
          </button>
        </div>
      ) : null}

      {actionPending ? (
        <div className="reviewConfirmation" role="alert">
          <strong>{actionPending === "approve" ? "Confirm approval" : "Confirm rejection"}</strong>
          <p>
            {actionPending === "approve"
              ? "This records a real review time for this one draft. Check the cited evidence before confirming."
              : "This rejects this one draft. It will remain unavailable to traveler-facing surfaces."}
          </p>
          <div className="rowActions">
            <button disabled={busy} onClick={() => onConfirmAction(actionPending)} type="button">
              {actionPending === "approve" ? "Confirm approve" : "Confirm reject"}
            </button>
            <button
              className="secondaryButton"
              disabled={busy}
              onClick={onCancelAction}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function LocalPresentationFactEditor({
  pois,
  onChanged,
}: {
  pois: Poi[];
  onChanged: () => Promise<void>;
}) {
  const [factType, setFactType] = useState<PoiLocalPresentationFactType>("local_name_zh");
  const [message, setMessage] = useState(
    "Each local-display fact starts as a draft and needs a separate per-item review.",
  );
  const [saving, setSaving] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const response = await fetch("/api/knowledge/facts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        poiId: String(form.get("poiId") ?? ""),
        factType,
        value: { text: String(form.get("text") ?? "") },
        sourceClass: String(form.get("sourceClass") ?? ""),
        sourceLocator: String(form.get("sourceLocator") ?? ""),
        evidenceSummary: String(form.get("evidenceSummary") ?? ""),
        confidence: Number(form.get("confidence") ?? 0),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(body?.error ?? "Local-display draft could not be saved.");
      return;
    }
    event.currentTarget.reset();
    setFactType("local_name_zh");
    await onChanged();
    setMessage("Draft saved. A separate per-item review assigns the verification time.");
  }

  return (
    <section aria-labelledby="local-presentation-editor-title">
      <h2 id="local-presentation-editor-title">Show-to-Local facts</h2>
      <p className="muted">
        These are independent execution facts. Saving one does not make it public, reviewed, or safe
        to show to a local person.
      </p>
      <form className="stackForm" onSubmit={(event) => void create(event)}>
        <label>
          POI
          <select name="poiId" required>
            <option value="">Choose POI</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          Local-display field
          <select
            name="factType"
            onChange={(event) => setFactType(event.target.value as PoiLocalPresentationFactType)}
            value={factType}
          >
            {PoiLocalPresentationFactTypeSchema.options.map((type) => (
              <option key={type} value={type}>
                {LOCAL_PRESENTATION_FACT_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        {factType === "local_address_zh" ? (
          <p className="danger" role="alert">
            This Chinese address can be shown to a real stranger. Check it against the cited source
            before saving, then complete a separate per-item review before it can be shown publicly.
          </p>
        ) : null}
        <label>
          Text (maximum 500 characters)
          <textarea maxLength={500} name="text" required />
        </label>
        <label>
          Source class
          <SourceClassSelect name="sourceClass" />
        </label>
        <label>
          Source URL or evidence reference
          <input maxLength={500} name="sourceLocator" required />
        </label>
        <label>
          Evidence summary (no personal contact details)
          <input maxLength={240} name="evidenceSummary" required />
        </label>
        <label>
          Confidence
          <input max="1" min="0" name="confidence" required step="0.05" type="number" />
        </label>
        <button disabled={saving} type="submit">
          Save local-display draft
        </button>
      </form>
      <p className={message.includes("could not") ? "danger" : "muted"}>{message}</p>
    </section>
  );
}

function factDisplayValue(fact: PoiFact): string {
  return typeof fact.value.text === "string"
    ? fact.value.text
    : typeof fact.value.label === "string"
      ? fact.value.label
      : JSON.stringify(fact.value);
}

function factValueInputId(fact: Pick<PoiFact, "id">, isLocalPresentationFact: boolean): string {
  return `${isLocalPresentationFact ? "local-fact" : "fact"}-${fact.id}`;
}

const LOCAL_PRESENTATION_FACT_LABELS: Record<PoiLocalPresentationFactType, string> = {
  local_name_zh: "Chinese local name",
  local_address_zh: "Chinese address",
  local_address_district: "District",
  local_address_nearest_metro_exit: "Nearest metro exit",
  local_address_visibility_note: "Visibility note",
};

type PoiDraft = {
  city: string;
  category: PoiCategory;
  nameEn: string;
  nameZh: string;
  latitude: string;
  longitude: string;
};

const EMPTY_POI_DRAFT: PoiDraft = {
  city: "",
  category: "attraction",
  nameEn: "",
  nameZh: "",
  latitude: "",
  longitude: "",
};

function PoiEditor({ pois, onChanged }: { pois: Poi[]; onChanged: () => Promise<void> }) {
  const [selectedPoiId, setSelectedPoiId] = useState("");
  const [draft, setDraft] = useState<PoiDraft>(EMPTY_POI_DRAFT);
  const [message, setMessage] = useState("Create a canonical POI before adding facts.");
  const [saving, setSaving] = useState(false);

  function choosePoi(id: string) {
    setSelectedPoiId(id);
    const poi = pois.find((candidate) => candidate.id === id);
    setDraft(poi ? draftFromPoi(poi) : EMPTY_POI_DRAFT);
    setMessage(
      poi ? "Edit canonical POI fields. Existing facts are unchanged." : "Create a new POI.",
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = parsePoiDraft(draft);
    if (!payload) {
      setMessage("Enter both coordinates or leave both blank. Coordinates must be valid numbers.");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/knowledge/pois", {
      method: selectedPoiId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selectedPoiId ? { id: selectedPoiId, ...payload } : payload),
    });
    const data = (await response.json().catch(() => null)) as Poi | { error: string } | null;
    setSaving(false);
    if (!response.ok || !data || "error" in data) {
      setMessage(data && "error" in data ? data.error : "POI save failed.");
      return;
    }

    setSelectedPoiId(data.id);
    setDraft(draftFromPoi(data));
    await onChanged();
    setMessage(
      selectedPoiId ? "POI saved. Facts remain independently reviewable." : "POI created.",
    );
  }

  return (
    <section aria-labelledby="poi-editor-title">
      <h2 id="poi-editor-title">Canonical POIs</h2>
      <p className="muted">
        Names, city, category, and coordinates identify a place. They do not create or verify any
        travel fact.
      </p>
      <form className="stackForm" onSubmit={(event) => void save(event)}>
        <label>
          Existing POI (optional)
          <select onChange={(event) => choosePoi(event.target.value)} value={selectedPoiId}>
            <option value="">Create new POI</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          English name
          <input
            maxLength={200}
            onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
            required
            value={draft.nameEn}
          />
        </label>
        <label>
          Chinese name (optional)
          <input
            maxLength={200}
            onChange={(event) => setDraft({ ...draft, nameZh: event.target.value })}
            value={draft.nameZh}
          />
        </label>
        <label>
          City
          <input
            maxLength={100}
            onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            required
            value={draft.city}
          />
        </label>
        <label>
          Category
          <select
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value as PoiCategory })
            }
            value={draft.category}
          >
            {PoiCategorySchema.options.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          Latitude (optional; requires longitude)
          <input
            max="90"
            min="-90"
            onChange={(event) => setDraft({ ...draft, latitude: event.target.value })}
            step="0.000001"
            type="number"
            value={draft.latitude}
          />
        </label>
        <label>
          Longitude (optional; requires latitude)
          <input
            max="180"
            min="-180"
            onChange={(event) => setDraft({ ...draft, longitude: event.target.value })}
            step="0.000001"
            type="number"
            value={draft.longitude}
          />
        </label>
        <button disabled={saving} type="submit">
          {selectedPoiId ? "Save POI" : "Create POI"}
        </button>
      </form>
      <p
        className={
          message.includes("failed") || message.includes("Enter both") ? "danger" : "muted"
        }
      >
        {message}
      </p>
    </section>
  );
}

function draftFromPoi(poi: Poi): PoiDraft {
  return {
    city: poi.city,
    category: poi.category,
    nameEn: poi.nameEn,
    nameZh: poi.nameZh ?? "",
    latitude: poi.latitude?.toString() ?? "",
    longitude: poi.longitude?.toString() ?? "",
  };
}

function parsePoiDraft(draft: PoiDraft): {
  city: string;
  category: PoiCategory;
  nameEn: string;
  nameZh: string | null;
  latitude: number | null;
  longitude: number | null;
} | null {
  const latitude = draft.latitude.trim() === "" ? null : Number(draft.latitude);
  const longitude = draft.longitude.trim() === "" ? null : Number(draft.longitude);
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null && !Number.isFinite(latitude)) ||
    (longitude !== null && !Number.isFinite(longitude))
  ) {
    return null;
  }
  return {
    city: draft.city,
    category: draft.category,
    nameEn: draft.nameEn,
    nameZh: draft.nameZh.trim() || null,
    latitude,
    longitude,
  };
}

function SourceClassSelect({
  ariaLabel,
  defaultValue = "",
  id,
  name,
}: {
  ariaLabel?: string;
  defaultValue?: string;
  id?: string;
  name?: string;
}) {
  return (
    <select aria-label={ariaLabel} defaultValue={defaultValue} id={id} name={name} required>
      <option value="">Source class</option>
      {PoiFactSourceClassSchema.options.map((sourceClass) => (
        <option key={sourceClass} value={sourceClass}>
          {SOURCE_CLASS_LABELS[sourceClass]}
        </option>
      ))}
    </select>
  );
}

const SOURCE_CLASS_LABELS: Record<PoiFactSourceClass, string> = {
  official: "Official",
  operator_verified: "Operator verified",
  reputable_editorial: "Reputable editorial",
  user_report: "User report (draft only)",
  model_output: "Model output (draft only)",
  uncorroborated_scrape: "Uncorroborated scrape (draft only)",
};
