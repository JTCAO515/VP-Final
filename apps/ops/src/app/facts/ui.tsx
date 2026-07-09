"use client";

import { useEffect, useMemo, useState } from "react";
import type { Poi } from "@visepanda/domain";

type SaveState = "idle" | "saving" | "saved" | "error";

export function FactEditor() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  async function loadPois() {
    const response = await fetch("/api/knowledge/pois");
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
    const input = document.getElementById(`fact-${factId}`) as HTMLInputElement | null;
    if (!input) return;

    setSaveState("saving");
    const response = await fetch("/api/knowledge/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ factId, value: { label: input.value } }),
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    setPois((await response.json()) as Poi[]);
    setSaveState("saved");
  }

  return (
    <section className="panel">
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
                  <small>{fact.source}</small>
                </td>
                <td>
                  <input
                    aria-label={`${fact.id} value`}
                    defaultValue={label}
                    id={`fact-${fact.id}`}
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
