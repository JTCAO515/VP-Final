"use client";

import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  PoiCategorySchema,
  PoiFactSourceClassSchema,
  PoiLocalPresentationFactTypeSchema,
  type Poi,
  type PoiCategory,
  type PoiFactSourceClass,
  type PoiLocalPresentationFactType,
  type PoiFact,
  type PoiImage,
  type DraftFactReviewQueueItem,
} from "@visepanda/domain";
import { displayLifecycleValue, displayPoiCategory } from "../../lib/presentation";

type SaveState = "idle" | "saving" | "saved" | "error";

export function FactEditor() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [genericFactMessage, setGenericFactMessage] = useState<string | null>(null);

  async function loadPois() {
    const response = await fetch(
      "/api/knowledge/pois?includeDrafts=1&includeExpired=1&includeDeprecated=1",
    );
    setPois((await response.json()) as Poi[]);
  }

  useEffect(() => {
    void loadPois();
  }, []);

  const rows = useMemo(
    () =>
      pois.flatMap((poi) =>
        poi.facts.map((fact) => {
          const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(fact.factType);
          return {
            fact,
            poi,
            localFactType: localFactType.success ? localFactType.data : null,
            label: factDisplayValue(fact),
          };
        }),
      ),
    [pois],
  );

  async function saveFact(fact: PoiFact) {
    setSaveState("saving");
    const saved = await persistDraft(fact);
    setSaveState(saved ? "saved" : "error");
  }

  async function persistDraft(fact: PoiFact): Promise<boolean> {
    const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(fact.factType);
    const value = document.getElementById(factValueInputId(fact, localFactType.success)) as
      HTMLInputElement | HTMLTextAreaElement | null;
    const sourceClass = document.getElementById(
      `source-class-${fact.id}`,
    ) as HTMLSelectElement | null;
    const sourceLocator = document.getElementById(
      `source-locator-${fact.id}`,
    ) as HTMLInputElement | null;
    const evidenceSummary = document.getElementById(
      `evidence-summary-${fact.id}`,
    ) as HTMLInputElement | null;
    const confidence = document.getElementById(`confidence-${fact.id}`) as HTMLInputElement | null;
    if (
      !value ||
      !sourceClass?.value ||
      !sourceLocator?.value.trim() ||
      !evidenceSummary?.value.trim() ||
      !confidence
    ) {
      return false;
    }

    const response = await fetch("/api/knowledge/facts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        factId: fact.id,
        value: localFactType.success ? { text: value.value } : { label: value.value },
        sourceClass: sourceClass.value,
        sourceLocator: sourceLocator.value,
        evidenceSummary: evidenceSummary.value,
        confidence: Number(confidence.value),
      }),
    });

    if (!response.ok) {
      return false;
    }

    setPois((await response.json()) as Poi[]);
    return true;
  }

  async function createFact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState("saving");
    const form = new FormData(event.currentTarget);
    const factType = String(form.get("factType") ?? "");
    if (PoiLocalPresentationFactTypeSchema.safeParse(factType).success) {
      setGenericFactMessage("此独立溯源字段请使用“向本地人展示”事实表单。");
      setSaveState("error");
      return;
    }
    const response = await fetch("/api/knowledge/facts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        poiId: String(form.get("poiId") ?? ""),
        factType,
        value: { label: String(form.get("label") ?? "") },
        sourceClass: String(form.get("sourceClass") ?? ""),
        sourceLocator: String(form.get("sourceLocator") ?? ""),
        evidenceSummary: String(form.get("evidenceSummary") ?? ""),
        confidence: Number(form.get("confidence") ?? 0),
      }),
    });
    if (!response.ok) {
      setGenericFactMessage("事实草稿未保存，请稍后重试。");
      setSaveState("error");
      return;
    }
    event.currentTarget.reset();
    await loadPois();
    setGenericFactMessage(null);
    setSaveState("saved");
  }

  return (
    <div className="factWorkspace">
      <DraftFactReviewQueue pois={pois} />
      <FactExpiryDashboard pois={pois} onChanged={loadPois} />
      <section className="panel">
        <PoiEditor pois={pois} onChanged={loadPois} />
        <PoiImageEditor pois={pois} />
        <LocalPresentationFactEditor pois={pois} onChanged={loadPois} />
        <h2>其他事实草稿</h2>
        <form className="inlineForm" onSubmit={(event) => void createFact(event)}>
          <select name="poiId" required>
            <option value="">选择地点</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
          <input name="factType" placeholder="事实类型" required />
          <input name="label" placeholder="简短标签" required />
          <input
            max="1"
            min="0"
            name="confidence"
            placeholder="0.9"
            required
            step="0.05"
            type="number"
          />
          <SourceClassSelect name="sourceClass" />
          <input name="sourceLocator" placeholder="来源 URL 或证据引用" required />
          <input
            maxLength={240}
            name="evidenceSummary"
            placeholder="此来源能证明什么（不含个人信息）"
            required
          />
          <button disabled={saveState === "saving"} type="submit">
            添加事实
          </button>
        </form>
        {genericFactMessage ? <p className="danger">{genericFactMessage}</p> : null}
        {rows.length === 0 ? (
          <p className="empty">没有加载到事实。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>城市</th>
                <th>地点</th>
                <th>事实</th>
                <th>内容</th>
                <th>版本</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ fact, label, localFactType, poi }) => (
                <tr key={fact.id}>
                  <td>{poi.city}</td>
                  <td>
                    <strong>{poi.nameEn}</strong>
                    <br />
                    <small>{displayPoiCategory(poi.category)}</small>
                  </td>
                  <td>
                    <span className="pill">{fact.factType}</span>
                    <br />
                    <small>{displayLifecycleValue(fact.status)}</small>
                    {fact.expiresAt && Date.parse(fact.expiresAt) < Date.now() ? (
                      <>
                        <br />
                        <small className="danger">已过期</small>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {localFactType ? (
                      <>
                        {localFactType === "local_address_zh" ? (
                          <small className="danger">真实世界地址：审核前请根据引用来源核验。</small>
                        ) : null}
                        <textarea
                          aria-label={`${fact.id} local-display text`}
                          defaultValue={label}
                          id={factValueInputId(fact, true)}
                          maxLength={500}
                        />
                      </>
                    ) : (
                      <input
                        aria-label={`${fact.id} value`}
                        defaultValue={label}
                        id={factValueInputId(fact, false)}
                      />
                    )}
                    <input
                      aria-label={`${fact.id} source locator`}
                      defaultValue={fact.sourceLocator ?? ""}
                      id={`source-locator-${fact.id}`}
                    />
                    <SourceClassSelect
                      ariaLabel={`${fact.id} source class`}
                      defaultValue={fact.sourceClass ?? ""}
                      id={`source-class-${fact.id}`}
                    />
                    <input
                      aria-label={`${fact.id} evidence summary`}
                      defaultValue={fact.evidenceSummary ?? ""}
                      id={`evidence-summary-${fact.id}`}
                      maxLength={240}
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
                        onClick={() => void saveFact(fact)}
                        type="button"
                      >
                        保存
                      </button>
                      {fact.status === "draft" ? (
                        <small>此草稿必须在逐条审核队列中审核。</small>
                      ) : null}
                      <small>
                        {fact.verifiedAt ? `已核验 ${fact.verifiedAt.slice(0, 10)}` : "未核验"}
                      </small>
                      {saveState !== "idle" ? (
                        <small>{displayLifecycleValue(saveState)}</small>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function PoiImageEditor({ pois }: { pois: Poi[] }) {
  const [images, setImages] = useState<PoiImage[]>([]);
  const [targetKind, setTargetKind] = useState<"poi" | "city" | "category">("poi");
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("仅限私有编辑素材。上传需要可核验的归属和授权说明。");

  async function loadImages() {
    const response = await fetch("/api/knowledge/images", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      images?: PoiImage[];
      error?: string;
    } | null;
    if (!response.ok || !payload || !Array.isArray(payload.images)) {
      throw new Error("私有图片元数据暂不可用。");
    }
    setImages(payload.images);
  }

  useEffect(() => {
    void loadImages().catch((error) => setMessage("私有图片元数据暂不可用。"));
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("正在校验并剥除私有图片元数据…");
    try {
      const response = await fetch("/api/knowledge/images", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error("图片上传失败。");
      event.currentTarget.reset();
      await loadImages();
      setState("saved");
      setMessage("私有编辑图片已保存，并附带归属和授权说明。 ");
    } catch (error) {
      setState("error");
      setMessage("图片上传失败，请稍后重试。");
    }
  }

  async function deleteImage(image: PoiImage) {
    setState("saving");
    setMessage("正在删除此私有图片并撤销其元数据…");
    try {
      const response = await fetch("/api/knowledge/images", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageId: image.id }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error("图片删除失败。");
      await loadImages();
      setState("saved");
      setMessage("私有图片已删除，元数据已撤销。 ");
    } catch (error) {
      setState("error");
      setMessage("图片删除失败，请稍后重试。");
    }
  }

  const cities = [...new Set(pois.map((poi) => poi.city))].sort();
  return (
    <section className="poiImageEditor" aria-labelledby="poi-image-title">
      <div>
        <p className="eyebrow">私有编辑媒体</p>
        <h2 id="poi-image-title">地点图片库</h2>
        <p className="muted">
          文件会通过签名校验、转换为不含 EXIF 的 WebP，并保持私有。本页面不会创建公开图片 URL
          或旅行者可见媒体。
        </p>
      </div>
      <form className="inlineForm" onSubmit={(event) => void upload(event)}>
        <select
          aria-label="图片目标类型"
          name="targetKind"
          onChange={(event) => setTargetKind(event.target.value as typeof targetKind)}
          value={targetKind}
        >
          <option value="poi">地点</option>
          <option value="city">城市</option>
          <option value="category">品类</option>
        </select>
        {targetKind === "poi" ? (
          <select aria-label="图片地点目标" name="poiId" required>
            <option value="">选择地点</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
        ) : null}
        {targetKind === "city" ? (
          <select aria-label="图片城市目标" name="city" required>
            <option value="">选择城市</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        ) : null}
        {targetKind === "category" ? (
          <select aria-label="图片品类目标" name="category" required>
            {PoiCategorySchema.options.map((category: PoiCategory) => (
              <option key={category} value={category}>
                {displayPoiCategory(category)}
              </option>
            ))}
          </select>
        ) : null}
        <input
          accept="image/jpeg,image/png,image/webp"
          aria-label="编辑图片文件"
          name="file"
          required
          type="file"
        />
        <input
          aria-label="图片归属"
          maxLength={500}
          name="attribution"
          placeholder="来源或版权持有人"
          required
        />
        <input
          aria-label="图片授权说明"
          maxLength={500}
          name="licenseNote"
          placeholder="已授权的编辑用途"
          required
        />
        <button disabled={state === "saving"} type="submit">
          保存私有图片
        </button>
      </form>
      <p className={state === "error" ? "danger" : "muted"} role="status">
        {message}
      </p>
      {images.length === 0 ? (
        <p className="empty">没有有效的私有编辑图片。</p>
      ) : (
        <ul className="factExpiryList">
          {images.map((image) => (
            <li className="factExpiryItem" key={image.id}>
              <div>
                <strong>
                  {image.target.kind === "poi"
                    ? "地点"
                    : image.target.kind === "city"
                      ? image.target.city
                      : displayPoiCategory(image.target.category)}
                </strong>
                <p className="muted">
                  {image.width} × {image.height} · {image.contentType} · 图片归属：
                  {image.attribution}
                </p>
                <p className="muted">授权说明：{image.licenseNote}</p>
              </div>
              <button
                disabled={state === "saving"}
                onClick={() => void deleteImage(image)}
                type="button"
              >
                删除私有图片
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type ExpiryAction = "renew" | "deprecate";

type ExpiryFactItem = {
  fact: PoiFact;
  poi: Poi;
  window: "expired" | "near_expiry";
};

export function FactExpiryDashboard({
  pois,
  onChanged,
  initialExpiredFactIds,
  now = () => new Date(),
}: {
  pois: Poi[];
  onChanged: () => Promise<void>;
  initialExpiredFactIds?: readonly string[];
  now?: () => Date;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [expiredFactIds, setExpiredFactIds] = useState<Set<string> | null>(() =>
    initialExpiredFactIds ? new Set(initialExpiredFactIds) : null,
  );
  const [message, setMessage] = useState("请先审核已过期的事实，再审核 30 天内将到期的事实。");
  const [pendingAction, setPendingAction] = useState<{
    factId: string;
    action: ExpiryAction;
  } | null>(null);
  const groups = useMemo(
    () => (expiredFactIds ? expiryFactGroups(pois, now(), expiredFactIds) : null),
    [expiredFactIds, now, pois],
  );

  async function loadExpiredFactIds() {
    const response = await fetch("/api/knowledge/facts/expiry", { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      expiredFactIds?: unknown;
    } | null;
    if (
      !response.ok ||
      !payload ||
      !Array.isArray(payload.expiredFactIds) ||
      !payload.expiredFactIds.every((id): id is string => typeof id === "string")
    ) {
      throw new Error("事实到期状态暂不可用。");
    }
    setExpiredFactIds(new Set(payload.expiredFactIds));
  }

  async function refreshFacts() {
    setState("saving");
    try {
      await Promise.all([onChanged(), loadExpiredFactIds()]);
      setState("idle");
      setMessage("已根据当前事实生命周期刷新到期窗口。 ");
    } catch (error) {
      setState("error");
      setMessage("事实到期状态暂不可用，请稍后重试。");
    }
  }

  useEffect(() => {
    if (initialExpiredFactIds) return;
    void refreshFacts();
  }, []);

  async function applyAction(factId: string, action: ExpiryAction) {
    setState("saving");
    setMessage(action === "renew" ? "正在续期此已核验事实…" : "正在废弃此事实…");
    try {
      const response = await fetch("/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ factId, action }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        throw new Error("此事实未更新。");
      }
      setPendingAction(null);
      await Promise.all([onChanged(), loadExpiredFactIds()]);
      setState("idle");
      setMessage(
        action === "renew"
          ? "已根据现有证据和策略续期一条已核验事实。"
          : "已废弃一条事实，它不会再显示给旅行者。",
      );
    } catch (error) {
      setState("error");
      setMessage("此事实未更新，请稍后重试。");
    }
  }

  return (
    <section className="panel factExpiryDashboard" aria-labelledby="fact-expiry-title">
      <div className="factExpiryHeading">
        <div>
          <p className="eyebrow">证据新鲜度</p>
          <h2 id="fact-expiry-title">事实到期看板</h2>
          <p className="muted">
            仅当现有证据仍有效时才续期。无法继续支持的事实应废弃；两种操作都不会将草稿变为已核验事实。
          </p>
        </div>
        <button
          className="secondaryButton"
          disabled={state === "saving"}
          onClick={() => void refreshFacts()}
          type="button"
        >
          刷新事实
        </button>
      </div>

      <p className={state === "error" ? "taskError" : "muted"} role="status">
        {message}
      </p>

      {groups ? (
        <>
          <FactExpiryWindow
            groups={groups.expired}
            pendingAction={pendingAction}
            state={state}
            title="已过期事实"
            onCancelAction={() => setPendingAction(null)}
            onConfirmAction={(factId, action) => void applyAction(factId, action)}
            onProposeAction={(factId, action) => setPendingAction({ factId, action })}
          />
          <FactExpiryWindow
            groups={groups.nearExpiry}
            pendingAction={pendingAction}
            state={state}
            title="30 天内到期"
            onCancelAction={() => setPendingAction(null)}
            onConfirmAction={(factId, action) => void applyAction(factId, action)}
            onProposeAction={(factId, action) => setPendingAction({ factId, action })}
          />
        </>
      ) : (
        <p className="muted">正在加载当前到期窗口。</p>
      )}
    </section>
  );
}

function FactExpiryWindow({
  groups,
  pendingAction,
  state,
  title,
  onCancelAction,
  onConfirmAction,
  onProposeAction,
}: {
  groups: Map<string, ExpiryFactItem[]>;
  pendingAction: { factId: string; action: ExpiryAction } | null;
  state: SaveState;
  title: string;
  onCancelAction: () => void;
  onConfirmAction: (factId: string, action: ExpiryAction) => void;
  onProposeAction: (factId: string, action: ExpiryAction) => void;
}) {
  return (
    <section className="factExpiryWindow" aria-label={title}>
      <h3>{title}</h3>
      {groups.size === 0 ? (
        <p className="empty">此窗口内没有已核验事实。</p>
      ) : (
        [...groups.entries()].map(([factType, items]) => (
          <section className="factExpiryGroup" key={factType}>
            <h4>
              {factType}
              {items[0]?.fact.reviewPolicy === "volatile-30d-v1" ? (
                <span className="pill">易变信息 · 30 天策略</span>
              ) : null}
            </h4>
            <div className="factExpiryList">
              {items.map((item) => (
                <FactExpiryCard
                  actionPending={
                    pendingAction?.factId === item.fact.id ? pendingAction.action : undefined
                  }
                  item={item}
                  key={item.fact.id}
                  busy={state === "saving"}
                  onCancelAction={onCancelAction}
                  onConfirmAction={(action) => onConfirmAction(item.fact.id, action)}
                  onProposeAction={(action) => onProposeAction(item.fact.id, action)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  );
}

function FactExpiryCard({
  actionPending,
  busy,
  item,
  onCancelAction,
  onConfirmAction,
  onProposeAction,
}: {
  actionPending: ExpiryAction | undefined;
  busy: boolean;
  item: ExpiryFactItem;
  onCancelAction: () => void;
  onConfirmAction: (action: ExpiryAction) => void;
  onProposeAction: (action: ExpiryAction) => void;
}) {
  const expiryDate = item.fact.expiresAt ? new Date(item.fact.expiresAt) : null;

  return (
    <article className="factExpiryItem">
      <div>
        <p className="eyebrow">
          {item.window === "expired" ? "已过期" : "即将到期"} · {item.poi.city}
        </p>
        <h5>{item.poi.nameEn}</h5>
        <p className="muted">
          {factDisplayValue(item.fact)} ·{" "}
          {expiryDate ? `到期 ${formatExpiryDate(expiryDate)}` : "无到期日期"}
        </p>
        <p className="muted">
          {item.fact.reviewPolicy ?? "无审核策略"}
          {item.fact.sourceLocator ? ` · ${item.fact.sourceLocator}` : " · 缺少来源定位信息"}
        </p>
      </div>

      {!actionPending ? (
        <div className="rowActions">
          <button disabled={busy} onClick={() => onProposeAction("renew")} type="button">
            续期此事实
          </button>
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={() => onProposeAction("deprecate")}
            type="button"
          >
            废弃此事实
          </button>
        </div>
      ) : (
        <div className="reviewConfirmation" role="alert">
          <strong>{actionPending === "renew" ? "确认续期" : "确认废弃"}</strong>
          <p>
            {actionPending === "renew"
              ? "请确认引用证据仍有效。续期将根据现有审核策略重新计算到期日。"
              : "此操作会将事实从旅行者可见资格中移除，但不会删除审计轨迹。"}
          </p>
          <div className="rowActions">
            <button disabled={busy} onClick={() => onConfirmAction(actionPending)} type="button">
              {actionPending === "renew" ? "确认续期" : "确认废弃"}
            </button>
            <button
              className="secondaryButton"
              disabled={busy}
              onClick={onCancelAction}
              type="button"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function expiryFactGroups(
  pois: Poi[],
  now: Date,
  expiredFactIds: ReadonlySet<string>,
): {
  expired: Map<string, ExpiryFactItem[]>;
  nearExpiry: Map<string, ExpiryFactItem[]>;
} {
  const currentTime = now.getTime();
  const nearExpiryLimit = currentTime + 30 * 24 * 60 * 60 * 1_000;
  const expired: ExpiryFactItem[] = [];
  const nearExpiry: ExpiryFactItem[] = [];

  for (const poi of pois) {
    for (const fact of poi.facts) {
      if (fact.status !== "reviewed" || !fact.expiresAt) continue;
      const expiry = Date.parse(fact.expiresAt);
      if (!Number.isFinite(expiry)) continue;
      if (expiredFactIds.has(fact.id)) {
        expired.push({ fact, poi, window: "expired" });
      } else if (expiry > currentTime && expiry <= nearExpiryLimit) {
        nearExpiry.push({ fact, poi, window: "near_expiry" });
      }
    }
  }

  return {
    expired: groupExpiryFacts(expired),
    nearExpiry: groupExpiryFacts(nearExpiry),
  };
}

function groupExpiryFacts(items: ExpiryFactItem[]): Map<string, ExpiryFactItem[]> {
  const grouped = new Map<string, ExpiryFactItem[]>();
  for (const item of [...items].sort(
    (left, right) =>
      Date.parse(left.fact.expiresAt ?? "").valueOf() -
      Date.parse(right.fact.expiresAt ?? "").valueOf(),
  )) {
    const entries = grouped.get(item.fact.factType) ?? [];
    entries.push(item);
    grouped.set(item.fact.factType, entries);
  }
  return grouped;
}

function formatExpiryDate(date: Date): string {
  return `Expires ${date.toISOString().slice(0, 10)}`;
}

type DraftReviewAction = "approve" | "reject";

type DraftReviewFilters = {
  poiId: string;
  factType: string;
  importBatchId: string;
};

const EMPTY_DRAFT_REVIEW_FILTERS: DraftReviewFilters = {
  poiId: "",
  factType: "",
  importBatchId: "",
};

function DraftFactReviewQueue({ pois }: { pois: Poi[] }) {
  const [items, setItems] = useState<DraftFactReviewQueueItem[]>([]);
  const [filters, setFilters] = useState<DraftReviewFilters>(EMPTY_DRAFT_REVIEW_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DraftReviewFilters>(
    EMPTY_DRAFT_REVIEW_FILTERS,
  );
  const [state, setState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("正在加载仍需人工决策的草稿。 ");
  const [pendingAction, setPendingAction] = useState<{
    factId: string;
    action: DraftReviewAction;
  } | null>(null);

  async function load(nextFilters = appliedFilters) {
    setState("saving");
    const params = new URLSearchParams();
    if (nextFilters.poiId) params.set("poiId", nextFilters.poiId);
    if (nextFilters.factType.trim()) params.set("factType", nextFilters.factType.trim());
    if (nextFilters.importBatchId.trim()) {
      params.set("importBatchId", nextFilters.importBatchId.trim());
    }
    try {
      const response = await fetch(`/api/knowledge/facts/review-queue?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        items?: DraftFactReviewQueueItem[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.items) {
        throw new Error("草稿审核队列暂不可用。");
      }
      setItems(payload.items);
      setState("idle");
      setMessage(
        payload.items.length === 0
          ? "没有符合筛选条件的事实草稿。系统未批准或隐藏任何内容。"
          : `${payload.items.length} 条事实草稿需要逐条决策。`,
      );
    } catch (error) {
      setState("error");
      setMessage("草稿审核队列暂不可用，请稍后重试。");
    }
  }

  useEffect(() => {
    void load(EMPTY_DRAFT_REVIEW_FILTERS);
  }, []);

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(filters);
    await load(filters);
  }

  async function applyAction(factId: string, action: DraftReviewAction, expectedVersion: number) {
    setState("saving");
    setMessage(action === "approve" ? "正在记录此审核…" : "正在拒绝此草稿…");
    try {
      const response = await fetch("/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? { factId, action: "approve_draft", expectedVersion }
            : { factId, action: "reject" },
        ),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        throw new Error("此草稿未更新。");
      }
      setPendingAction(null);
      await load(appliedFilters);
      setMessage(
        action === "approve"
          ? "已审核一条草稿；仅在证据仍有效时它才具备资格。"
          : "已拒绝一条草稿；它仍不会显示给旅行者。",
      );
    } catch (error) {
      setState("error");
      setMessage("此草稿未更新，请稍后重试。");
    }
  }

  async function saveCorrection(fact: PoiFact, form: FormData): Promise<boolean> {
    const value = String(form.get("value") ?? "").trim();
    const sourceClass = String(form.get("sourceClass") ?? "");
    const sourceLocator = String(form.get("sourceLocator") ?? "").trim();
    const evidenceSummary = String(form.get("evidenceSummary") ?? "").trim();
    const confidence = Number(form.get("confidence") ?? NaN);
    const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(fact.factType);
    if (
      !value ||
      !sourceClass ||
      !sourceLocator ||
      !evidenceSummary ||
      !Number.isFinite(confidence)
    ) {
      setState("error");
      setMessage("请先更正内容、来源、证据摘要和置信度，再保存。 ");
      return false;
    }

    setState("saving");
    try {
      const response = await fetch("/api/knowledge/facts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          factId: fact.id,
          value: localFactType.success ? { text: value } : { label: value },
          sourceClass,
          sourceLocator,
          evidenceSummary,
          confidence,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok || !payload || "error" in payload) {
        throw new Error("此草稿更正未保存。");
      }
      await load(appliedFilters);
      setMessage("更正已作为草稿保存。请重新审核后再单独确认批准。 ");
      return true;
    } catch (error) {
      setState("error");
      setMessage("此草稿更正未保存，请稍后重试。");
      return false;
    }
  }

  return (
    <section className="panel draftReviewQueue" aria-labelledby="draft-review-title">
      <div className="draftReviewHeading">
        <div>
          <p className="eyebrow">仅人工审核</p>
          <h2 id="draft-review-title">事实草稿审核队列</h2>
          <p className="muted">
            每次操作只作用于一条草稿。导入内容或模型生成内容会保持草稿状态，直到人工核验其证据并在此确认决策。
          </p>
        </div>
        <button
          className="secondaryButton"
          disabled={state === "saving"}
          onClick={() => void load(appliedFilters)}
          type="button"
        >
          刷新队列
        </button>
      </div>

      <form className="filters" onSubmit={(event) => void submitFilters(event)}>
        <label>
          地点
          <select
            onChange={(event) => setFilters({ ...filters, poiId: event.target.value })}
            value={filters.poiId}
          >
            <option value="">全部地点</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          事实类型
          <input
            list="draft-fact-types"
            onChange={(event) => setFilters({ ...filters, factType: event.target.value })}
            placeholder="local_address_zh"
            value={filters.factType}
          />
          <datalist id="draft-fact-types">
            {[...new Set(items.map((item) => item.draft.factType))].sort().map((factType) => (
              <option key={factType} value={factType} />
            ))}
          </datalist>
        </label>
        <label>
          导入批次
          <input
            onChange={(event) => setFilters({ ...filters, importBatchId: event.target.value })}
            placeholder="批次 UUID 或 legacy-unbatched"
            value={filters.importBatchId}
          />
        </label>
        <div className="rowActions">
          <button disabled={state === "saving"} type="submit">
            应用筛选
          </button>
          <button
            className="secondaryButton"
            disabled={state === "saving"}
            onClick={() => {
              setFilters(EMPTY_DRAFT_REVIEW_FILTERS);
              setAppliedFilters(EMPTY_DRAFT_REVIEW_FILTERS);
              void load(EMPTY_DRAFT_REVIEW_FILTERS);
            }}
            type="button"
          >
            清除筛选
          </button>
        </div>
      </form>

      <p className={state === "error" ? "taskError" : "muted"} role="status">
        {message}
      </p>
      {items.length > 0 ? (
        <div className="draftReviewList">
          {items.map((item) => (
            <DraftFactReviewCard
              actionPending={
                pendingAction?.factId === item.draft.id ? pendingAction.action : undefined
              }
              busy={state === "saving"}
              item={item}
              key={`${item.draft.id}-${item.draft.version}`}
              onCancelAction={() => setPendingAction(null)}
              onConfirmAction={(action) =>
                void applyAction(item.draft.id, action, item.draft.version)
              }
              onProposeAction={(action) => setPendingAction({ factId: item.draft.id, action })}
              onSaveCorrection={saveCorrection}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function DraftFactReviewCard({
  actionPending,
  busy,
  item,
  onCancelAction,
  onConfirmAction,
  onProposeAction,
  onSaveCorrection,
}: {
  actionPending: DraftReviewAction | undefined;
  busy: boolean;
  item: DraftFactReviewQueueItem;
  onCancelAction: () => void;
  onConfirmAction: (action: DraftReviewAction) => void;
  onProposeAction: (action: DraftReviewAction) => void;
  onSaveCorrection: (fact: PoiFact, form: FormData) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const localFactType = PoiLocalPresentationFactTypeSchema.safeParse(item.draft.factType);
  const value = factDisplayValue(item.draft);
  const cardTitleId = `draft-review-${item.draft.id}`;

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSaveCorrection(item.draft, new FormData(event.currentTarget))) setEditing(false);
  }

  return (
    <article className="draftReviewItem" aria-labelledby={cardTitleId}>
      <header>
        <div>
          <p className="eyebrow">草稿 · {item.poi.city}</p>
          <h3 id={cardTitleId}>{item.poi.nameEn}</h3>
          <p className="muted">
            {item.poi.nameZh ? `${item.poi.nameZh} · ` : ""}
            {displayPoiCategory(item.poi.category)} · 版本 {item.draft.version}
          </p>
        </div>
        <span className="pill">{item.draft.factType}</span>
      </header>

      {item.draft.factType === "local_address_zh" ? (
        <p className="taskError">
          此中文地址可能会展示给真实的陌生人。任何批准前都必须根据引用来源核验。
        </p>
      ) : null}

      <dl className="draftFactDetails">
        <div>
          <dt>草稿内容</dt>
          <dd>{value}</dd>
        </div>
        <div>
          <dt>来源等级</dt>
          <dd>
            {item.draft.sourceClass ? SOURCE_CLASS_LABELS[item.draft.sourceClass] : "缺少来源等级"}
          </dd>
        </div>
        <div>
          <dt>来源定位信息</dt>
          <dd>{item.draft.sourceLocator}</dd>
        </div>
        <div>
          <dt>证据摘要</dt>
          <dd>{item.draft.evidenceSummary}</dd>
        </div>
        <div>
          <dt>导入上下文</dt>
          <dd>
            {item.importContext
              ? `${item.importContext.importBatchId ?? "legacy-unbatched"} · ${item.importContext.collectionRowId} · ${item.importContext.collectionStatus}`
              : "未通过已记录的批次导入。"}
          </dd>
        </div>
      </dl>

      <section className="reviewedSiblings" aria-label={`${item.poi.nameEn} 的已核验事实`}>
        <h4>此地点的其他已核验事实</h4>
        {item.reviewedSiblings.length === 0 ? (
          <p className="muted">没有其他可用于交叉判断的已核验事实。</p>
        ) : (
          <ul>
            {item.reviewedSiblings.map((sibling) => (
              <li key={sibling.id}>
                <strong>{sibling.factType}</strong> · {factDisplayValue(sibling)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <form className="reviewCorrectionForm" onSubmit={(event) => void saveCorrection(event)}>
          <h4>批准前更正此草稿</h4>
          <label>
            内容
            {localFactType.success ? (
              <textarea defaultValue={value} maxLength={500} name="value" required />
            ) : (
              <input defaultValue={value} name="value" required />
            )}
          </label>
          <label>
            来源等级
            <SourceClassSelect defaultValue={item.draft.sourceClass ?? ""} name="sourceClass" />
          </label>
          <label>
            来源定位信息
            <input
              defaultValue={item.draft.sourceLocator ?? ""}
              maxLength={500}
              name="sourceLocator"
              required
            />
          </label>
          <label>
            证据摘要
            <input
              defaultValue={item.draft.evidenceSummary ?? ""}
              maxLength={240}
              name="evidenceSummary"
              required
            />
          </label>
          <label>
            置信度
            <input
              defaultValue={item.draft.confidence}
              max="1"
              min="0"
              name="confidence"
              required
              step="0.05"
              type="number"
            />
          </label>
          <div className="rowActions">
            <button disabled={busy} type="submit">
              将更正保存为草稿
            </button>
            <button
              className="secondaryButton"
              disabled={busy}
              onClick={() => setEditing(false)}
              type="button"
            >
              取消更正
            </button>
          </div>
        </form>
      ) : null}

      {!editing && !actionPending ? (
        <div className="rowActions">
          <button disabled={busy} onClick={() => onProposeAction("approve")} type="button">
            批准此草稿
          </button>
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={() => setEditing(true)}
            type="button"
          >
            批准前更正
          </button>
          <button
            className="secondaryButton"
            disabled={busy}
            onClick={() => onProposeAction("reject")}
            type="button"
          >
            拒绝此草稿
          </button>
        </div>
      ) : null}

      {actionPending ? (
        <div className="reviewConfirmation" role="alert">
          <strong>{actionPending === "approve" ? "确认批准" : "确认拒绝"}</strong>
          <p>
            {actionPending === "approve"
              ? "这会记录此一条草稿的实际审核时间。确认前请检查引用证据。"
              : "这会拒绝此一条草稿；它仍不会显示给旅行者。"}
          </p>
          <div className="rowActions">
            <button disabled={busy} onClick={() => onConfirmAction(actionPending)} type="button">
              {actionPending === "approve" ? "确认批准" : "确认拒绝"}
            </button>
            <button
              className="secondaryButton"
              disabled={busy}
              onClick={onCancelAction}
              type="button"
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function LocalPresentationFactEditor({
  pois,
  onChanged,
}: {
  pois: Poi[];
  onChanged: () => Promise<void>;
}) {
  const [factType, setFactType] = useState<PoiLocalPresentationFactType>("local_name_zh");
  const [message, setMessage] = useState("每条本地展示事实都从草稿开始，且需要单独逐条审核。");
  const [saving, setSaving] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const response = await fetch("/api/knowledge/facts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        poiId: String(form.get("poiId") ?? ""),
        factType,
        value: { text: String(form.get("text") ?? "") },
        sourceClass: String(form.get("sourceClass") ?? ""),
        sourceLocator: String(form.get("sourceLocator") ?? ""),
        evidenceSummary: String(form.get("evidenceSummary") ?? ""),
        confidence: Number(form.get("confidence") ?? 0),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage("本地展示草稿未保存，请稍后重试。 ");
      return;
    }
    event.currentTarget.reset();
    setFactType("local_name_zh");
    await onChanged();
    setMessage("草稿已保存。单独逐条审核时才会记录核验时间。 ");
  }

  return (
    <section aria-labelledby="local-presentation-editor-title">
      <h2 id="local-presentation-editor-title">向本地人展示的事实</h2>
      <p className="muted">
        这些是独立执行事实。保存不代表它已公开、已核验或可以安全展示给本地人。
      </p>
      <form className="stackForm" onSubmit={(event) => void create(event)}>
        <label>
          地点
          <select name="poiId" required>
            <option value="">选择地点</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          本地展示字段
          <select
            name="factType"
            onChange={(event) => setFactType(event.target.value as PoiLocalPresentationFactType)}
            value={factType}
          >
            {PoiLocalPresentationFactTypeSchema.options.map((type) => (
              <option key={type} value={type}>
                {LOCAL_PRESENTATION_FACT_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        {factType === "local_address_zh" ? (
          <p className="danger" role="alert">
            此中文地址可能会展示给真实陌生人。保存前请根据引用来源核验；公开展示前还必须完成单独的逐条审核。
          </p>
        ) : null}
        <label>
          文本（最多 500 个字符）
          <textarea maxLength={500} name="text" required />
        </label>
        <label>
          来源等级
          <SourceClassSelect name="sourceClass" />
        </label>
        <label>
          来源 URL 或证据引用
          <input maxLength={500} name="sourceLocator" required />
        </label>
        <label>
          证据摘要（不含个人联系方式）
          <input maxLength={240} name="evidenceSummary" required />
        </label>
        <label>
          置信度
          <input max="1" min="0" name="confidence" required step="0.05" type="number" />
        </label>
        <button disabled={saving} type="submit">
          保存本地展示草稿
        </button>
      </form>
      <p className={message.includes("未保存") ? "danger" : "muted"}>{message}</p>
    </section>
  );
}

function factDisplayValue(fact: PoiFact): string {
  return typeof fact.value.text === "string"
    ? fact.value.text
    : typeof fact.value.label === "string"
      ? fact.value.label
      : JSON.stringify(fact.value);
}

function factValueInputId(fact: Pick<PoiFact, "id">, isLocalPresentationFact: boolean): string {
  return `${isLocalPresentationFact ? "local-fact" : "fact"}-${fact.id}`;
}

const LOCAL_PRESENTATION_FACT_LABELS: Record<PoiLocalPresentationFactType, string> = {
  local_name_zh: "中文本地名称",
  local_address_zh: "中文地址",
  local_address_district: "行政区",
  local_address_nearest_metro_exit: "最近地铁出口",
  local_address_visibility_note: "可见性说明",
};

type PoiDraft = {
  city: string;
  category: PoiCategory;
  nameEn: string;
  nameZh: string;
  latitude: string;
  longitude: string;
};

const EMPTY_POI_DRAFT: PoiDraft = {
  city: "",
  category: "attraction",
  nameEn: "",
  nameZh: "",
  latitude: "",
  longitude: "",
};

function PoiEditor({ pois, onChanged }: { pois: Poi[]; onChanged: () => Promise<void> }) {
  const [selectedPoiId, setSelectedPoiId] = useState("");
  const [draft, setDraft] = useState<PoiDraft>(EMPTY_POI_DRAFT);
  const [message, setMessage] = useState("请先创建规范地点，再添加事实。 ");
  const [saving, setSaving] = useState(false);

  function choosePoi(id: string) {
    setSelectedPoiId(id);
    const poi = pois.find((candidate) => candidate.id === id);
    setDraft(poi ? draftFromPoi(poi) : EMPTY_POI_DRAFT);
    setMessage(poi ? "正在编辑规范地点字段，既有事实不会改变。" : "创建新的地点。");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = parsePoiDraft(draft);
    if (!payload) {
      setMessage("请同时填写经纬度或同时留空；坐标必须是有效数字。 ");
      return;
    }

    setSaving(true);
    const response = await fetch("/api/knowledge/pois", {
      method: selectedPoiId ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selectedPoiId ? { id: selectedPoiId, ...payload } : payload),
    });
    const data = (await response.json().catch(() => null)) as Poi | { error: string } | null;
    setSaving(false);
    if (!response.ok || !data || "error" in data) {
      setMessage("地点未保存，请稍后重试。 ");
      return;
    }

    setSelectedPoiId(data.id);
    setDraft(draftFromPoi(data));
    await onChanged();
    setMessage(selectedPoiId ? "地点已保存，事实仍可独立审核。" : "地点已创建。");
  }

  return (
    <section aria-labelledby="poi-editor-title">
      <h2 id="poi-editor-title">规范地点（POI）</h2>
      <p className="muted">名称、城市、品类和坐标仅用于识别地点，不会创建或核验任何旅行事实。</p>
      <form className="stackForm" onSubmit={(event) => void save(event)}>
        <label>
          现有地点（可选）
          <select onChange={(event) => choosePoi(event.target.value)} value={selectedPoiId}>
            <option value="">创建新地点</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.city} · {poi.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          英文名称
          <input
            maxLength={200}
            onChange={(event) => setDraft({ ...draft, nameEn: event.target.value })}
            required
            value={draft.nameEn}
          />
        </label>
        <label>
          中文名称（可选）
          <input
            maxLength={200}
            onChange={(event) => setDraft({ ...draft, nameZh: event.target.value })}
            value={draft.nameZh}
          />
        </label>
        <label>
          城市
          <input
            maxLength={100}
            onChange={(event) => setDraft({ ...draft, city: event.target.value })}
            required
            value={draft.city}
          />
        </label>
        <label>
          品类
          <select
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value as PoiCategory })
            }
            value={draft.category}
          >
            {PoiCategorySchema.options.map((category) => (
              <option key={category} value={category}>
                {displayPoiCategory(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          纬度（可选；需同时填写经度）
          <input
            max="90"
            min="-90"
            onChange={(event) => setDraft({ ...draft, latitude: event.target.value })}
            step="0.000001"
            type="number"
            value={draft.latitude}
          />
        </label>
        <label>
          经度（可选；需同时填写纬度）
          <input
            max="180"
            min="-180"
            onChange={(event) => setDraft({ ...draft, longitude: event.target.value })}
            step="0.000001"
            type="number"
            value={draft.longitude}
          />
        </label>
        <button disabled={saving} type="submit">
          {selectedPoiId ? "保存地点" : "创建地点"}
        </button>
      </form>
      <p
        className={
          message.includes("未保存") || message.includes("请同时填写") ? "danger" : "muted"
        }
      >
        {message}
      </p>
    </section>
  );
}

function draftFromPoi(poi: Poi): PoiDraft {
  return {
    city: poi.city,
    category: poi.category,
    nameEn: poi.nameEn,
    nameZh: poi.nameZh ?? "",
    latitude: poi.latitude?.toString() ?? "",
    longitude: poi.longitude?.toString() ?? "",
  };
}

function parsePoiDraft(draft: PoiDraft): {
  city: string;
  category: PoiCategory;
  nameEn: string;
  nameZh: string | null;
  latitude: number | null;
  longitude: number | null;
} | null {
  const latitude = draft.latitude.trim() === "" ? null : Number(draft.latitude);
  const longitude = draft.longitude.trim() === "" ? null : Number(draft.longitude);
  if (
    (latitude === null) !== (longitude === null) ||
    (latitude !== null && !Number.isFinite(latitude)) ||
    (longitude !== null && !Number.isFinite(longitude))
  ) {
    return null;
  }
  return {
    city: draft.city,
    category: draft.category,
    nameEn: draft.nameEn,
    nameZh: draft.nameZh.trim() || null,
    latitude,
    longitude,
  };
}

function SourceClassSelect({
  ariaLabel,
  defaultValue = "",
  id,
  name,
}: {
  ariaLabel?: string;
  defaultValue?: string;
  id?: string;
  name?: string;
}) {
  return (
    <select aria-label={ariaLabel} defaultValue={defaultValue} id={id} name={name} required>
      <option value="">来源等级</option>
      {PoiFactSourceClassSchema.options.map((sourceClass) => (
        <option key={sourceClass} value={sourceClass}>
          {SOURCE_CLASS_LABELS[sourceClass]}
        </option>
      ))}
    </select>
  );
}

const SOURCE_CLASS_LABELS: Record<PoiFactSourceClass, string> = {
  official: "官方来源",
  operator_verified: "运营人员已核验",
  reputable_editorial: "可信编辑来源",
  user_report: "用户报告（仅草稿）",
  model_output: "模型输出（仅草稿）",
  uncorroborated_scrape: "未证实抓取内容（仅草稿）",
};
