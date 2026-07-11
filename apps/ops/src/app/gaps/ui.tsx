"use client";

import { useEffect, useState } from "react";
import type { KnowledgeGap } from "@visepanda/domain";

type GapStatus = KnowledgeGap["status"] | "all";

export default function GapsPage() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [status, setStatus] = useState<GapStatus>("open");
  const [error, setError] = useState<string | null>(null);

  async function loadGaps(nextStatus = status) {
    setError(null);
    const suffix = nextStatus === "all" ? "" : `?status=${nextStatus}`;
    const response = await fetch(`/api/knowledge/gaps${suffix}`);
    if (!response.ok) {
      setError("Could not load gaps.");
      return;
    }
    setGaps((await response.json()) as KnowledgeGap[]);
  }

  useEffect(() => {
    void loadGaps(status);
  }, [status]);

  async function updateGap(gapId: string, nextStatus: KnowledgeGap["status"]) {
    setError(null);
    const response = await fetch("/api/knowledge/gaps", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gapId, status: nextStatus }),
    });
    if (!response.ok) {
      setError("Could not update this gap.");
      return;
    }
    await loadGaps();
  }

  return (
    <>
      <section className="heading">
        <h1>Knowledge gaps</h1>
        <p className="muted">Questions Copilot could not answer well become editorial work.</p>
      </section>
      <section className="panel">
        <div className="filters">
          {(["open", "resolved", "ignored", "all"] as const).map((item) => (
            <button
              className={status === item ? "selected" : ""}
              key={item}
              onClick={() => setStatus(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        {error ? <p className="empty danger">{error}</p> : null}
        {gaps.length === 0 ? (
          <p className="empty">No gaps in this queue.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>City</th>
                <th>Pattern</th>
                <th>Frequency</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr key={gap.id}>
                  <td>{gap.city ?? "All cities"}</td>
                  <td>{gap.questionPattern}</td>
                  <td>{gap.frequency}</td>
                  <td>
                    <span className="pill">{gap.status}</span>
                    {gap.resolvedAt ? (
                      <>
                        <br />
                        <small>{new Date(gap.resolvedAt).toLocaleDateString()}</small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <div className="rowActions">
                      <button onClick={() => void updateGap(gap.id, "resolved")} type="button">
                        Resolve
                      </button>
                      <button onClick={() => void updateGap(gap.id, "ignored")} type="button">
                        Ignore
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
