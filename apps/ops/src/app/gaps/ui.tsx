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
      setError("无法加载知识缺口，请稍后重试。");
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
      setError("无法更新此知识缺口，请稍后重试。");
      return;
    }
    await loadGaps();
  }

  return (
    <>
      <section className="heading">
        <h1>知识缺口</h1>
        <p className="muted">VisePanda 无法可靠回答的问题会进入编辑处理队列。</p>
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
              {displayGapStatus(item)}
            </button>
          ))}
        </div>
        {error ? <p className="empty danger">{error}</p> : null}
        {gaps.length === 0 ? (
          <p className="empty">此队列中没有知识缺口。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>城市</th>
                <th>问题模式</th>
                <th>出现次数</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((gap) => (
                <tr key={gap.id}>
                  <td>{gap.city ?? "全部城市"}</td>
                  <td>{gap.questionPattern}</td>
                  <td>{gap.frequency}</td>
                  <td>
                    <span className="pill">{displayGapStatus(gap.status)}</span>
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
                        标记已解决
                      </button>
                      <button onClick={() => void updateGap(gap.id, "ignored")} type="button">
                        忽略
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

function displayGapStatus(status: GapStatus): string {
  return {
    all: "全部",
    ignored: "已忽略",
    open: "待处理",
    resolved: "已解决",
  }[status];
}
