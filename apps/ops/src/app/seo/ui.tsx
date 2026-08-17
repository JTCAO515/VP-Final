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
  const [message, setMessage] = useState("选择地点和意图以核验当前资格。");
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
      setMessage("地点暂不可用。");
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
      setMessage("此地点和意图当前没有证据支持的页面。 ");
      return;
    }
    if (!response.ok) {
      setSaveState("error");
      setMessage("编辑文案覆盖暂不可用。");
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
    setMessage(data.override ? "正在编辑已保存的仅展示文案。" : "保存前将使用自动生成的文案。");
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
      setMessage("未保存覆盖文案。请至少保留一个字段并核验资格。");
      return;
    }
    const data = (await response.json()) as { override: SeoEditorialOverride };
    setOverride(data.override);
    setSaveState("saved");
    setMessage("已保存。公开页面仍需要当前已核验的事实。 ");
  }

  async function remove() {
    if (!poiId || !override) return;
    setSaveState("saving");
    const query = new URLSearchParams({ poiId, intent });
    const response = await fetch(`/api/knowledge/seo-overrides?${query}`, { method: "DELETE" });
    if (!response.ok) {
      setSaveState("error");
      setMessage("未删除覆盖文案。 ");
      return;
    }
    setOverride(null);
    setTitle("");
    setSummary("");
    setEmphasis("");
    setSaveState("saved");
    setMessage("已删除，已恢复使用自动生成的候选文案。 ");
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
          aria-label="地点"
          onChange={(event: ChangeEvent<HTMLSelectElement>) => setPoiId(event.target.value)}
          value={poiId}
        >
          <option value="">选择地点</option>
          {pois.map((poi) => (
            <option key={poi.id} value={poi.id}>
              {poi.city} · {poi.nameEn}
            </option>
          ))}
        </select>
        <select
          aria-label="SEO 意图"
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
          <p className="muted">自动生成的备用文案：{candidate.title}</p>
          <label>
            标题（可选，最多 140 个字符）
            <input
              maxLength={140}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label>
            摘要（可选，最多 240 个字符）
            <textarea
              maxLength={240}
              onChange={(event) => setSummary(event.target.value)}
              value={summary}
            />
          </label>
          <label>
            编辑备注（可选，最多 600 个字符）
            <textarea
              maxLength={600}
              onChange={(event) => setEmphasis(event.target.value)}
              value={emphasis}
            />
          </label>
          <div className="rowActions">
            <button disabled={saveState === "saving" || saveState === "loading"} type="submit">
              保存展示文案
            </button>
            {override ? (
              <button
                disabled={saveState === "saving" || saveState === "loading"}
                onClick={() => void remove()}
                type="button"
              >
                恢复自动生成文案
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
