"use client";

import React, { useEffect, useState } from "react";
import type { OpsAuditEvent } from "@visepanda/app-server";

type AuditFilters = { action: string; actorId: string; from: string; to: string };
const emptyFilters: AuditFilters = { action: "", actorId: "", from: "", to: "" };

export function AuditLedger() {
  const [events, setEvents] = useState<OpsAuditEvent[]>([]);
  const [filters, setFilters] = useState<AuditFilters>(emptyFilters);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  async function load(nextFilters = filters) {
    setState("loading");
    setMessage(null);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(nextFilters)) if (value) params.set(key, value);
      const response = await fetch(`/api/audit?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; events?: OpsAuditEvent[] };
      if (!response.ok || !payload.events) throw new Error("无法加载审计记录。");
      setEvents(payload.events);
      setState("ready");
    } catch (error) {
      setMessage("无法加载审计记录，请稍后重试。");
      setState("error");
    }
  }

  useEffect(() => void load(emptyFilters), []);

  return (
    <section className="panel auditLedger">
      <form
        className="auditFilters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label>
          精确操作者 ID
          <input
            onChange={(event) => setFilters({ ...filters, actorId: event.target.value })}
            placeholder="UUID"
            value={filters.actorId}
          />
        </label>
        <label>
          精确操作类型
          <input
            onChange={(event) => setFilters({ ...filters, action: event.target.value })}
            placeholder="membership.revoked"
            value={filters.action}
          />
        </label>
        <label>
          开始时间
          <input
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            type="datetime-local"
            value={filters.from}
          />
        </label>
        <label>
          结束时间
          <input
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            type="datetime-local"
            value={filters.to}
          />
        </label>
        <button type="submit">应用筛选</button>
      </form>
      <p className="auditNote">默认显示最近 30 天。单次查询最多覆盖 90 天，最多返回 100 条记录。</p>
      {state === "loading" ? <p className="empty">正在加载审计记录…</p> : null}
      {state === "error" ? (
        <div className="empty taskError">
          <p>{message}</p>
          <button onClick={() => void load()} type="button">
            重试
          </button>
        </div>
      ) : null}
      {state === "ready" && events.length === 0 ? (
        <p className="empty">没有符合这些精确筛选条件的审计记录。</p>
      ) : null}
      {state === "ready" && events.length > 0 ? (
        <div className="auditList">
          {events.map((event) => (
            <AuditEventCard event={event} key={event.id} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function AuditEventCard({ event }: { event: OpsAuditEvent }) {
  return (
    <article className="auditEvent">
      <header>
        <strong>{event.action}</strong>
        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
      </header>
      <dl>
        <div>
          <dt>操作者</dt>
          <dd>
            <code>{event.actorId}</code>
          </dd>
        </div>
        <div>
          <dt>目标</dt>
          <dd>
            {event.targetType}
            {event.targetId ? ` · ${event.targetId}` : ""}
          </dd>
        </div>
      </dl>
      {Object.keys(event.metadata).length > 0 ? (
        <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
      ) : (
        <p className="muted">没有可显示的元数据。</p>
      )}
    </article>
  );
}
