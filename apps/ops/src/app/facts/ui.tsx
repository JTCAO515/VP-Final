"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Poi } from "@visepanda/domain";

type SaveState = "idle" | "saving" | "saved" | "error";

export function FactEditor() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function loadPois() {
    const response = await fetch("/api/knowledge/pois?includeExpired=1&includeDeprecated=1");
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
    const value = document.getElementById(`fact-${factId}`) as HTMLInputElement | null;
    const source = document.getElementById(`source-${factId}`) as HTMLInputElement | null;
    const confidence = document.getElementById(`confidence-${factId}`) as HTMLInputElement | null;
    if (!value || !source || !confidence || !source.value.trim()) {
      setSaveState("error");
      return;
    }

    setSaveState("saving");
    const response = await fetch("/api/knowledge/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        factId,
        value: { label: value.value },
        source: source.value,
        confidence: Number(confidence.value),
      }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    setPois((await response.json()) as Poi[]);
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
        source: String(form.get("source") ?? ""),
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
        <input name="source" placeholder="source" required />
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
                    aria-label={`${fact.id} source`}
                    defaultValue={fact.source}
                    id={`source-${fact.id}`}
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
