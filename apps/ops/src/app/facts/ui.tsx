"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Poi } from "@visepanda/domain";

type SaveState = "idle" | "saving" | "saved" | "error";

export function FactEditor() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

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
        poi.facts.map((fact) => ({
          fact,
          poi,
          label:
            typeof fact.value.label === "string" ? fact.value.label : JSON.stringify(fact.value),
        })),
      ),
    [pois],
  );

  async function saveFact(factId: string) {
    setSaveState("saving");
    const saved = await persistDraft(factId);
    setSaveState(saved ? "saved" : "error");
  }

  async function persistDraft(factId: string): Promise<boolean> {
    const value = document.getElementById(`fact-${factId}`) as HTMLInputElement | null;
    const sourceClass = document.getElementById(
      `source-class-${factId}`,
    ) as HTMLSelectElement | null;
    const sourceLocator = document.getElementById(
      `source-locator-${factId}`,
    ) as HTMLInputElement | null;
    const evidenceSummary = document.getElementById(
      `evidence-summary-${factId}`,
    ) as HTMLInputElement | null;
    const confidence = document.getElementById(`confidence-${factId}`) as HTMLInputElement | null;
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
        factId,
        value: { label: value.value },
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

  async function reviewFact(factId: string) {
    setSaveState("saving");
    if (!(await persistDraft(factId))) {
      setSaveState("error");
      return;
    }
    const response = await fetch("/api/knowledge/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ factId, action: "renew" }),
    });
    if (!response.ok) {
      setSaveState("error");
      return;
    }
    await loadPois();
    setSaveState("saved");
  }

  async function createFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/knowledge/facts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        poiId: String(form.get("poiId") ?? ""),
        factType: String(form.get("factType") ?? ""),
        value: { label: String(form.get("label") ?? "") },
        sourceClass: String(form.get("sourceClass") ?? ""),
        sourceLocator: String(form.get("sourceLocator") ?? ""),
        evidenceSummary: String(form.get("evidenceSummary") ?? ""),
        confidence: Number(form.get("confidence") ?? 0),
      }),
    });
    if (!response.ok) {
      setSaveState("error");
      return;
    }
    event.currentTarget.reset();
    await loadPois();
    setSaveState("saved");
  }

  return (
    <section className="panel">
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
            {rows.map(({ fact, label, poi }) => (
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
                  <input
                    aria-label={`${fact.id} value`}
                    defaultValue={label}
                    id={`fact-${fact.id}`}
                  />
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
                      onClick={() => void saveFact(fact.id)}
                      type="button"
                    >
                      Save
                    </button>
                    {fact.status === "draft" ? (
                      <button
                        disabled={saveState === "saving"}
                        onClick={() => void reviewFact(fact.id)}
                        type="button"
                      >
                        Mark reviewed
                      </button>
                    ) : null}
                    <small>
                      {fact.verifiedAt ? `verified ${fact.verifiedAt.slice(0, 10)}` : "unverified"}
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
  );
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
      <option value="official">Official</option>
      <option value="operator_verified">Operator verified</option>
      <option value="reputable_editorial">Reputable editorial</option>
      <option value="user_report">User report (draft only)</option>
      <option value="model_output">Model output (draft only)</option>
      <option value="uncorroborated_scrape">Uncorroborated scrape (draft only)</option>
    </select>
  );
}
