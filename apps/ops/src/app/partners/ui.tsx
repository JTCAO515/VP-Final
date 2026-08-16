"use client";

import type { Partner } from "@visepanda/domain";
import React, { useEffect, useState, type FormEvent } from "react";

type PartnerForm = {
  key: string;
  hosts: string;
  categories: string;
  cities: string;
  trackingParam: string;
  kind: Partner["kind"];
};

const emptyForm: PartnerForm = {
  key: "",
  hosts: "",
  categories: "",
  cities: "",
  trackingParam: "vp_click_id",
  kind: "ota",
};

export function PartnerManager() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [form, setForm] = useState<PartnerForm>(emptyForm);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  async function load(options: { preserveMessage?: boolean } = {}) {
    setState("loading");
    if (!options.preserveMessage) setMessage(null);
    try {
      const response = await fetch("/api/partners", { cache: "no-store" });
      const payload = (await response.json()) as {
        ok?: boolean;
        partners?: Partner[];
        error?: string;
      };
      if (!response.ok || !payload.partners)
        throw new Error(payload.error ?? "Could not load partners.");
      setPartners(payload.partners);
      setState("ready");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load partners.");
      setState("error");
      return false;
    }
  }

  useEffect(() => void load(), []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/partners", {
        method: editingKey ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: editingKey ?? form.key,
          hosts: values(form.hosts),
          categories: values(form.categories),
          cities: values(form.cities),
          trackingParam: form.trackingParam,
          kind: form.kind,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save partner configuration.");
      setForm(emptyForm);
      setEditingKey(null);
      if (await load({ preserveMessage: true })) {
        setMessage(
          editingKey
            ? "Configuration saved. Status was not changed."
            : "Partner created as pending.",
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save partner configuration.");
      setState("error");
    }
  }

  function edit(partner: Partner) {
    setEditingKey(partner.key);
    setForm({
      key: partner.key,
      hosts: partner.hosts.join(", "),
      categories: partner.categories.join(", "),
      cities: partner.cities.join(", "),
      trackingParam: partner.trackingParam,
      kind: partner.kind,
    });
    setMessage("Editing configuration only. Saving cannot activate this partner.");
  }

  async function changeStatus(partner: Partner, status: Partner["status"]) {
    const confirmActivation =
      status !== "active" ||
      window.confirm(
        partner.kind === "ota"
          ? `Activate ${partner.key}? Public redirects remain possible only for exact configured HTTPS hosts.`
          : `Activate ${partner.key}? This activates an acquisition-source record only and cannot create a public redirect.`,
      );
    if (!confirmActivation) return;
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/partners", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: partner.key, status, confirmActivation }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not change partner status.");
      if (await load({ preserveMessage: true })) {
        setMessage(`${partner.key} is now ${status}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change partner status.");
      setState("error");
    }
  }

  return (
    <div className="partnerWorkspace">
      <section className="panel partnerEditor" aria-labelledby="partner-editor-title">
        <div>
          <p className="eyebrow">{editingKey ? "Edit configuration" : "New partner"}</p>
          <h2 id="partner-editor-title">{editingKey ?? "Create pending partner"}</h2>
          <p className="muted">
            Hosts are bare DNS names. Saving configuration never changes status.
          </p>
        </div>
        <form onSubmit={(event) => void save(event)}>
          <label>
            Partner key
            <input
              disabled={editingKey !== null}
              onChange={(event) => setForm({ ...form, key: event.target.value })}
              placeholder="partner_key"
              required
              value={editingKey ?? form.key}
            />
          </label>
          <label>
            Exact hosts
            <input
              onChange={(event) => setForm({ ...form, hosts: event.target.value })}
              placeholder="partner.example.com, www.partner.example.com"
              required
              value={form.hosts}
            />
          </label>
          <label>
            Categories
            <input
              onChange={(event) => setForm({ ...form, categories: event.target.value })}
              placeholder="hotel, experience"
              value={form.categories}
            />
          </label>
          <label>
            Cities
            <input
              onChange={(event) => setForm({ ...form, cities: event.target.value })}
              placeholder="Beijing, Shanghai"
              value={form.cities}
            />
          </label>
          <label>
            Tracking parameter
            <input
              onChange={(event) => setForm({ ...form, trackingParam: event.target.value })}
              required
              value={form.trackingParam}
            />
          </label>
          <label>
            Partner type
            <select
              onChange={(event) =>
                setForm({ ...form, kind: event.target.value as Partner["kind"] })
              }
              value={form.kind}
            >
              <option value="ota">OTA outbound destination</option>
              <option value="creator">Creator acquisition source</option>
            </select>
          </label>
          <div className="rowActions">
            <button disabled={state === "saving"} type="submit">
              {editingKey ? "Save configuration" : "Create pending"}
            </button>
            {editingKey ? (
              <button
                className="secondaryButton"
                onClick={() => {
                  setEditingKey(null);
                  setForm(emptyForm);
                  setMessage(null);
                }}
                type="button"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
        {message ? (
          <p className={state === "error" ? "taskError" : "partnerNotice"} role="status">
            {message}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="partner-list-title">
        <div className="partnerListHeading">
          <div>
            <p className="eyebrow">Registry</p>
            <h2 id="partner-list-title">Configured partners</h2>
          </div>
          <span className="pill">{partners.length} records</span>
        </div>
        {state === "loading" ? <p className="panel empty">Loading partner configuration…</p> : null}
        {state === "error" && partners.length === 0 ? (
          <div className="panel empty">
            <p>Partner configuration is unavailable.</p>
            <button onClick={() => void load()} type="button">
              Retry
            </button>
          </div>
        ) : null}
        {state !== "loading" && partners.length === 0 && state !== "error" ? (
          <p className="panel empty">No partner configuration exists.</p>
        ) : null}
        <div className="partnerList">
          {partners.map((partner) => (
            <PartnerConfigurationCard
              key={partner.key}
              disabled={state === "saving"}
              onEdit={() => edit(partner)}
              onStatusChange={(status) => void changeStatus(partner, status)}
              partner={partner}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export function PartnerConfigurationCard({
  disabled,
  onEdit,
  onStatusChange,
  partner,
}: {
  disabled: boolean;
  onEdit: () => void;
  onStatusChange: (status: Partner["status"]) => void;
  partner: Partner;
}) {
  return (
    <article className="panel partnerCard">
      <header>
        <div>
          <strong>{partner.key}</strong>
          <span className={`partnerStatus partnerStatus-${partner.status}`}>{partner.status}</span>
        </div>
        <button className="secondaryButton" disabled={disabled} onClick={onEdit} type="button">
          Edit
        </button>
      </header>
      <dl>
        <div>
          <dt>Exact hosts</dt>
          <dd>{partner.hosts.join(", ")}</dd>
        </div>
        <div>
          <dt>Categories</dt>
          <dd>{partner.categories.join(", ") || "None"}</dd>
        </div>
        <div>
          <dt>Cities</dt>
          <dd>{partner.cities.join(", ") || "All configured contexts"}</dd>
        </div>
        <div>
          <dt>Tracking parameter</dt>
          <dd>{partner.trackingParam}</dd>
        </div>
        <div>
          <dt>Partner type</dt>
          <dd>
            {partner.kind === "creator" ? "Creator acquisition source" : "OTA outbound destination"}
          </dd>
        </div>
      </dl>
      {partner.status === "pending" ? (
        <p className="partnerPreviewNotice">
          {partner.kind === "creator"
            ? "Preview only. This creator source cannot redirect or produce an outbound click."
            : "Preview only. No redirect or click can be produced."}
        </p>
      ) : null}
      <div className="partnerStatusActions" aria-label={`Change ${partner.key} status`}>
        {partner.status !== "pending" ? (
          <button disabled={disabled} onClick={() => onStatusChange("pending")} type="button">
            Set pending
          </button>
        ) : null}
        {partner.status !== "inactive" ? (
          <button disabled={disabled} onClick={() => onStatusChange("inactive")} type="button">
            Set inactive
          </button>
        ) : null}
        {partner.status !== "active" ? (
          <button
            className="activateButton"
            disabled={disabled}
            onClick={() => onStatusChange("active")}
            type="button"
          >
            Activate…
          </button>
        ) : null}
      </div>
    </article>
  );
}

function values(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
