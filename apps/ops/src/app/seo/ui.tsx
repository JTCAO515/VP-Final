"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  SeoPageIntentSchema,
  type Poi,
  type SeoEditorialOverride,
  type SeoPageCandidate,
} from "@visepanda/domain";

type SaveState = "idle" | "loading" | "saving" | "saved" | "error";

export function SeoEditorialOverrideEditor() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [poiId, setPoiId] = useState("");
  const [intent, setIntent] = useState<(typeof SeoPageIntentSchema.options)[number]>("transport");
  const [override, setOverride] = useState<SeoEditorialOverride | null>(null);
  const [candidate, setCandidate] = useState<SeoPageCandidate | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [emphasis, setEmphasis] = useState("");
  const [message, setMessage] = useState("Choose a POI and intent to check current eligibility.");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    void loadPois();
  }, []);

  useEffect(() => {
    if (!poiId) return;
    void loadOverride();
  }, [poiId, intent]);

  async function loadPois() {
    const response = await fetch("/api/knowledge/pois");
    if (!response.ok) {
      setSaveState("error");
      setMessage("POIs are unavailable.");
      return;
    }
    setPois((await response.json()) as Poi[]);
  }

  async function loadOverride() {
    setSaveState("loading");
    const query = new URLSearchParams({ poiId, intent });
    const response = await fetch(`/api/knowledge/seo-overrides?${query}`);
    if (response.status === 404) {
      resetEditor();
      setSaveState("idle");
      setMessage("No current evidence-backed page exists for this POI and intent.");
      return;
    }
    if (!response.ok) {
      setSaveState("error");
      setMessage("The editorial override is unavailable.");
      return;
    }
    const data = (await response.json()) as {
      candidate: SeoPageCandidate;
      override: SeoEditorialOverride | null;
    };
    setCandidate(data.candidate);
    setOverride(data.override);
    setTitle(data.override?.title ?? "");
    setSummary(data.override?.summary ?? "");
    setEmphasis(data.override?.emphasis ?? "");
    setSaveState("idle");
    setMessage(
      data.override ? "Editing saved presentation-only copy." : "Using generated copy until saved.",
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!poiId || !candidate) return;
    setSaveState("saving");
    const response = await fetch("/api/knowledge/seo-overrides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ poiId, intent, title, summary, emphasis }),
    });
    if (!response.ok) {
      setSaveState("error");
      setMessage("The override was not saved. Keep at least one field and verify eligibility.");
      return;
    }
    const data = (await response.json()) as { override: SeoEditorialOverride };
    setOverride(data.override);
    setSaveState("saved");
    setMessage("Saved. Public pages still require their current reviewed facts.");
  }

  async function remove() {
    if (!poiId || !override) return;
    setSaveState("saving");
    const query = new URLSearchParams({ poiId, intent });
    const response = await fetch(`/api/knowledge/seo-overrides?${query}`, { method: "DELETE" });
    if (!response.ok) {
      setSaveState("error");
      setMessage("The override was not deleted.");
      return;
    }
    setOverride(null);
    setTitle("");
    setSummary("");
    setEmphasis("");
    setSaveState("saved");
    setMessage("Deleted. The generated candidate copy is active again.");
  }

  function resetEditor() {
    setCandidate(null);
    setOverride(null);
    setTitle("");
    setSummary("");
    setEmphasis("");
  }

  return (
    <section className="panel">
      <div className="inlineForm">
        <select
          aria-label="POI"
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setPoiId(event.target.value)}
          value={poiId}
        >
          <option value="">Choose POI</option>
          {pois.map((poi) => (
            <option key={poi.id} value={poi.id}>
              {poi.city} · {poi.nameEn}
            </option>
          ))}
        </select>
        <select
          aria-label="SEO intent"
          onChange={(event: ChangeEvent<HTMLSelectElement>) =>
            setIntent(event.target.value as (typeof SeoPageIntentSchema.options)[number])
          }
          value={intent}
        >
          {SeoPageIntentSchema.options.map(
            (option: (typeof SeoPageIntentSchema.options)[number]) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ),
          )}
        </select>
      </div>

      <p className={saveState === "error" ? "danger" : "muted"}>{message}</p>
      {candidate ? (
        <form className="stackForm" onSubmit={(event) => void save(event)}>
          <p className="muted">Generated fallback: {candidate.title}</p>
          <label>
            Title (optional, 140 characters)
            <input
              maxLength={140}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label>
            Summary (optional, 240 characters)
            <textarea
              maxLength={240}
              onChange={(event) => setSummary(event.target.value)}
              value={summary}
            />
          </label>
          <label>
            Editor&apos;s note (optional, 600 characters)
            <textarea
              maxLength={600}
              onChange={(event) => setEmphasis(event.target.value)}
              value={emphasis}
            />
          </label>
          <div className="rowActions">
            <button disabled={saveState === "saving" || saveState === "loading"} type="submit">
              Save presentation copy
            </button>
            {override ? (
              <button
                disabled={saveState === "saving" || saveState === "loading"}
                onClick={() => void remove()}
                type="button"
              >
                Restore generated copy
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
