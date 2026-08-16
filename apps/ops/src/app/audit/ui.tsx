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
      if (!response.ok || !payload.events)
        throw new Error(payload.error ?? "Could not load audit events.");
      setEvents(payload.events);
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load audit events.");
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
          Exact actor id
          <input
            onChange={(event) => setFilters({ ...filters, actorId: event.target.value })}
            placeholder="UUID"
            value={filters.actorId}
          />
        </label>
        <label>
          Exact action
          <input
            onChange={(event) => setFilters({ ...filters, action: event.target.value })}
            placeholder="membership.revoked"
            value={filters.action}
          />
        </label>
        <label>
          From
          <input
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            type="datetime-local"
            value={filters.from}
          />
        </label>
        <label>
          To
          <input
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            type="datetime-local"
            value={filters.to}
          />
        </label>
        <button type="submit">Apply filters</button>
      </form>
      <p className="auditNote">
        Default: latest 30 days. A query may cover at most 90 days and returns at most 100 events.
      </p>
      {state === "loading" ? <p className="empty">Loading audit events…</p> : null}
      {state === "error" ? (
        <div className="empty taskError">
          <p>{message}</p>
          <button onClick={() => void load()} type="button">
            Retry
          </button>
        </div>
      ) : null}
      {state === "ready" && events.length === 0 ? (
        <p className="empty">No audit events match these exact filters.</p>
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
          <dt>Actor</dt>
          <dd>
            <code>{event.actorId}</code>
          </dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>
            {event.targetType}
            {event.targetId ? ` · ${event.targetId}` : ""}
          </dd>
        </div>
      </dl>
      {Object.keys(event.metadata).length > 0 ? (
        <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
      ) : (
        <p className="muted">No displayable metadata.</p>
      )}
    </article>
  );
}
