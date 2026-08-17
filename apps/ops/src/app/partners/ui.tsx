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
      if (!response.ok || !payload.partners) throw new Error("无法加载合作伙伴配置。");
      setPartners(payload.partners);
      setState("ready");
      return true;
    } catch (error) {
      setMessage("无法加载合作伙伴配置，请稍后重试。");
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
      if (!response.ok) throw new Error("无法保存合作伙伴配置。");
      setForm(emptyForm);
      setEditingKey(null);
      if (await load({ preserveMessage: true })) {
        setMessage(editingKey ? "配置已保存，状态未改变。" : "已创建待启用合作伙伴。");
      }
    } catch (error) {
      setMessage("无法保存合作伙伴配置，请稍后重试。");
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
    setMessage("当前仅编辑配置；保存不会启用此合作伙伴。");
  }

  async function changeStatus(partner: Partner, status: Partner["status"]) {
    const confirmActivation =
      status !== "active" ||
      window.confirm(
        partner.kind === "ota"
          ? `启用 ${partner.key}？公开跳转仍只会指向精确配置的 HTTPS 主机。`
          : `启用 ${partner.key}？这只会启用获客来源记录，不能创建公开跳转。`,
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
      if (!response.ok) throw new Error("无法更改合作伙伴状态。");
      if (await load({ preserveMessage: true })) {
        setMessage(`${partner.key} 当前状态为「${displayPartnerStatus(status)}」。`);
      }
    } catch (error) {
      setMessage("无法更改合作伙伴状态，请稍后重试。");
      setState("error");
    }
  }

  return (
    <div className="partnerWorkspace">
      <section className="panel partnerEditor" aria-labelledby="partner-editor-title">
        <div>
          <p className="eyebrow">{editingKey ? "编辑配置" : "新建合作伙伴"}</p>
          <h2 id="partner-editor-title">{editingKey ?? "创建待启用合作伙伴"}</h2>
          <p className="muted">主机仅填写 DNS 名称；保存配置不会改变状态。</p>
        </div>
        <form onSubmit={(event) => void save(event)}>
          <label>
            合作伙伴标识
            <input
              disabled={editingKey !== null}
              onChange={(event) => setForm({ ...form, key: event.target.value })}
              placeholder="partner_key"
              required
              value={editingKey ?? form.key}
            />
          </label>
          <label>
            精确主机名
            <input
              onChange={(event) => setForm({ ...form, hosts: event.target.value })}
              placeholder="partner.example.com, www.partner.example.com"
              required
              value={form.hosts}
            />
          </label>
          <label>
            品类
            <input
              onChange={(event) => setForm({ ...form, categories: event.target.value })}
              placeholder="hotel, experience"
              value={form.categories}
            />
          </label>
          <label>
            城市
            <input
              onChange={(event) => setForm({ ...form, cities: event.target.value })}
              placeholder="北京, 上海"
              value={form.cities}
            />
          </label>
          <label>
            跟踪参数
            <input
              onChange={(event) => setForm({ ...form, trackingParam: event.target.value })}
              required
              value={form.trackingParam}
            />
          </label>
          <label>
            合作伙伴类型
            <select
              onChange={(event) =>
                setForm({ ...form, kind: event.target.value as Partner["kind"] })
              }
              value={form.kind}
            >
              <option value="ota">OTA 外跳目标</option>
              <option value="creator">内容创作者获客来源</option>
            </select>
          </label>
          <div className="rowActions">
            <button disabled={state === "saving"} type="submit">
              {editingKey ? "保存配置" : "创建待启用项"}
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
                取消
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
            <p className="eyebrow">登记册</p>
            <h2 id="partner-list-title">已配置合作伙伴</h2>
          </div>
          <span className="pill">{partners.length} 条记录</span>
        </div>
        {state === "loading" ? <p className="panel empty">正在加载合作伙伴配置…</p> : null}
        {state === "error" && partners.length === 0 ? (
          <div className="panel empty">
            <p>合作伙伴配置暂不可用。</p>
            <button onClick={() => void load()} type="button">
              重试
            </button>
          </div>
        ) : null}
        {state !== "loading" && partners.length === 0 && state !== "error" ? (
          <p className="panel empty">尚未配置合作伙伴。</p>
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
          <span className={`partnerStatus partnerStatus-${partner.status}`}>
            {displayPartnerStatus(partner.status)}
          </span>
        </div>
        <button className="secondaryButton" disabled={disabled} onClick={onEdit} type="button">
          编辑
        </button>
      </header>
      <dl>
        <div>
          <dt>精确主机名</dt>
          <dd>{partner.hosts.join(", ")}</dd>
        </div>
        <div>
          <dt>品类</dt>
          <dd>{partner.categories.join(", ") || "无"}</dd>
        </div>
        <div>
          <dt>城市</dt>
          <dd>{partner.cities.join(", ") || "所有已配置场景"}</dd>
        </div>
        <div>
          <dt>跟踪参数</dt>
          <dd>{partner.trackingParam}</dd>
        </div>
        <div>
          <dt>合作伙伴类型</dt>
          <dd>{partner.kind === "creator" ? "内容创作者获客来源" : "OTA 外跳目标"}</dd>
        </div>
      </dl>
      {partner.status === "pending" ? (
        <p className="partnerPreviewNotice">
          {partner.kind === "creator"
            ? "仅供预览。此创作者来源不能跳转，也不会产生外跳点击。"
            : "仅供预览。不会产生跳转或点击。"}
        </p>
      ) : null}
      <div className="partnerStatusActions" aria-label={`更改 ${partner.key} 的状态`}>
        {partner.status !== "pending" ? (
          <button disabled={disabled} onClick={() => onStatusChange("pending")} type="button">
            设为待启用
          </button>
        ) : null}
        {partner.status !== "inactive" ? (
          <button disabled={disabled} onClick={() => onStatusChange("inactive")} type="button">
            设为停用
          </button>
        ) : null}
        {partner.status !== "active" ? (
          <button
            className="activateButton"
            disabled={disabled}
            onClick={() => onStatusChange("active")}
            type="button"
          >
            启用…
          </button>
        ) : null}
      </div>
    </article>
  );
}

function displayPartnerStatus(status: Partner["status"]): string {
  return { active: "有效", inactive: "停用", pending: "待启用" }[status];
}

function values(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}
