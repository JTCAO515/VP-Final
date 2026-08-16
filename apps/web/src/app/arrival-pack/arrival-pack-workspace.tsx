"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrivalPackSchema,
  ChinaReadinessSavedAssessmentSchema,
  TOOLS_CONTENT_PACK,
  TripStateSchema,
  createArrivalPack,
  type ArrivalPack,
  type ChinaReadinessSavedAssessment,
  type TripState,
} from "@visepanda/domain";
import { captureClientTelemetry } from "../../lib/clientTelemetry";
import { useLocale } from "../../i18n/locale-provider";

const LAST_TRIP_ID_KEY = "visepanda.lastTripId";
const ARRIVAL_PACK_STORAGE_KEY = "visepanda.arrivalPack.v1";
const PACK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

type LoadState = "loading" | "ready" | "empty" | "unavailable";
type PackState = "idle" | "generated" | "error";

type TripResponse = { ok: true; trip: unknown; version: unknown } | { ok: false; error: string };
type ReadinessResponse = { ok: true; assessment: unknown | null } | { ok: false; error: string };

export function ArrivalPackWorkspace() {
  const { t } = useLocale();
  const [trip, setTrip] = useState<TripState | null>(null);
  const [tripVersion, setTripVersion] = useState<number | null>(null);
  const [readiness, setReadiness] = useState<ChinaReadinessSavedAssessment | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [pack, setPack] = useState<ArrivalPack | null>(null);
  const [packState, setPackState] = useState<PackState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadCurrentTrip();
    const saved = readSavedArrivalPack(window.localStorage);
    if (saved) setPack(saved);
  }, []);

  const packMetadata = useMemo(
    () =>
      pack
        ? {
            packVersion: pack.version,
            firstDayBlockCount: pack.firstDay.blocks.length,
            reviewedAddressCount: pack.verifiedAddresses.length,
            readinessIncluded: pack.readiness !== null,
          }
        : null,
    [pack],
  );

  async function loadCurrentTrip(): Promise<void> {
    const tripId = window.localStorage.getItem(LAST_TRIP_ID_KEY);
    if (!tripId) {
      setLoadState("empty");
      return;
    }

    try {
      const tripResponse = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
        cache: "no-store",
      });
      const tripBody = (await tripResponse.json()) as TripResponse;
      if (!tripResponse.ok || !tripBody.ok) {
        setLoadState("empty");
        return;
      }
      const currentTrip = TripStateSchema.parse(tripBody.trip);
      const currentVersion = nonNegativeInteger(tripBody.version);
      if (currentVersion === null) throw new Error("Trip version is unavailable.");
      setTrip(currentTrip);
      setTripVersion(currentVersion);
      setLoadState("ready");

      const readinessResponse = await fetch(
        `/api/readiness?tripId=${encodeURIComponent(currentTrip.id)}`,
        { cache: "no-store" },
      );
      const readinessBody = (await readinessResponse.json()) as ReadinessResponse;
      if (readinessResponse.ok && readinessBody.ok && readinessBody.assessment !== null) {
        setReadiness(ChinaReadinessSavedAssessmentSchema.parse(readinessBody.assessment));
      }
    } catch {
      setLoadState("unavailable");
    }
  }

  function generatePack(): void {
    if (!trip || tripVersion === null) return;
    const now = new Date();
    const nextPack = createArrivalPack({
      trip,
      tripVersion,
      generatedAt: now,
      expiresAt: new Date(now.getTime() + PACK_LIFETIME_MS),
      readiness: readiness
        ? {
            version: readiness.result.version,
            savedAt: readiness.savedAt,
            result: readiness.result,
          }
        : null,
    });
    const isRegeneration = pack !== null;
    setPack(nextPack);
    setPackState("generated");
    try {
      window.localStorage.setItem(ARRIVAL_PACK_STORAGE_KEY, JSON.stringify(nextPack));
      setMessage(
        "Your pack is saved in this browser. Download its offline HTML file or print it before you travel.",
      );
    } catch {
      setMessage(
        "Your pack was created for this page, but this browser could not save it locally. Download it before leaving this page.",
      );
    }
    captureClientTelemetry({
      action: isRegeneration ? "arrival_pack_regenerated" : "arrival_pack_generated",
      entity_type: "arrival_pack",
      entity_id: nextPack.tripId,
      props_jsonb: arrivalPackTelemetryProps(nextPack),
    });
  }

  function downloadPack(): void {
    if (!pack || !packMetadata) return;
    const file = new Blob([renderArrivalPackHtml(pack)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "visepanda-arrival-pack.html";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setMessage(
      "Your browser started the download. Open the HTML file without a connection, or print it to a PDF from your browser.",
    );
    captureClientTelemetry({
      action: "arrival_pack_downloaded",
      entity_type: "arrival_pack",
      entity_id: pack.tripId,
      props_jsonb: packMetadata,
    });
  }

  return (
    <>
      <section className="arrivalPackHero" aria-labelledby="arrival-pack-title">
        <div>
          <p className="pageEyebrow">{t("arrival.eyebrow")}</p>
          <h1 id="arrival-pack-title">{t("arrival.title")}</h1>
          <p>
            A compact first-day pack you can save in this browser, download as HTML, or print to a
            PDF before a connection becomes unreliable.
          </p>
        </div>
        <aside className="arrivalPackBoundary" aria-label="Arrival Pack limits">
          <b>What this pack does not do</b>
          <p>
            It is a local copy of selected trip information, not live booking, payment, emergency,
            map, or inventory data. Check time-sensitive information before acting.
          </p>
        </aside>
      </section>

      <section className="arrivalPackContent" aria-label="Arrival Pack generator">
        <div className="arrivalPackGenerator">
          <p className="pageEyebrow">{t("arrival.currentTrip")}</p>
          {loadState === "loading" ? <p>Checking this browser for your current Trip...</p> : null}
          {loadState === "empty" ? (
            <div className="arrivalPackEmpty">
              <h2>No current Trip is available.</h2>
              <p>
                Create or open a Trip in VisePanda first. We will not create a first-day plan for
                you here.
              </p>
              <a className="pageAction" href="/visepanda?context=trip">
                {t("arrival.open")}
              </a>
            </div>
          ) : null}
          {loadState === "unavailable" ? (
            <div className="arrivalPackEmpty">
              <h2>Your current Trip could not be loaded.</h2>
              <p>No pack was generated. Check your connection and try again.</p>
              <button onClick={() => void loadCurrentTrip()} type="button">
                Try again
              </button>
            </div>
          ) : null}
          {loadState === "ready" && trip ? (
            <div className="arrivalPackTripSummary">
              <h2>{trip.title}</h2>
              <dl>
                <div>
                  <dt>{t("arrival.firstDay")}</dt>
                  <dd>{trip.days[0]?.city ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>{t("arrival.readiness")}</dt>
                  <dd>{readiness ? "Included" : "Not saved"}</dd>
                </div>
                <div>
                  <dt>{t("arrival.addresses")}</dt>
                  <dd>Not available from this Trip yet</dd>
                </div>
              </dl>
              <button onClick={generatePack} type="button">
                {pack ? t("arrival.regenerate") : t("arrival.generate")}
              </button>
              <p className="arrivalPackHint">
                Generation is explicit. We keep only the privacy-minimized projection in this
                browser; no raw conversation, notes, address text, passport, payment, or credential
                data is added.
              </p>
            </div>
          ) : null}
        </div>

        <aside className="arrivalPackPreview" aria-live="polite">
          {pack === null ? (
            <div className="arrivalPackPreviewEmpty">
              <p className="pageEyebrow">{t("arrival.preview")}</p>
              <h2>Nothing has been generated.</h2>
              <p>When a current Trip is available, you can create a limited offline copy here.</p>
            </div>
          ) : (
            <div>
              <p className="pageEyebrow">{t("arrival.preview")}</p>
              <h2>{pack.tripTitle}</h2>
              <p className="arrivalPackMeta">
                Generated {formatDate(pack.generatedAt)} · Expires {formatDate(pack.expiresAt)}
              </p>
              <section>
                <h3>{t("arrival.firstDay")}</h3>
                {pack.firstDay.blocks.length ? (
                  <ol>
                    {pack.firstDay.blocks.map((block, index) => (
                      <li key={`${block.title}-${index}`}>
                        <b>{block.title}</b>
                        <span>{formatBlockTime(block.startTime, block.endTime)}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No first-day activities were available when this pack was generated.</p>
                )}
              </section>
              <section>
                <h3>{t("arrival.addresses")}</h3>
                <p>
                  {pack.verifiedAddresses.length
                    ? `${pack.verifiedAddresses.length} reviewed address receipt(s) included.`
                    : "No reviewed Chinese address receipt is available, so none is included."}
                </p>
              </section>
              <section>
                <h3>Local preparation cards</h3>
                <ul className="arrivalPackTools">
                  {TOOLS_CONTENT_PACK.items
                    .filter((item) =>
                      ["payment_prep", "network_esim", "emergency_boundary", "transport"].includes(
                        item.id,
                      ),
                    )
                    .map((item) => (
                      <li key={item.id}>{item.title}</li>
                    ))}
                </ul>
              </section>
              <div className="arrivalPackActions">
                <button onClick={downloadPack} type="button">
                  {t("arrival.download")}
                </button>
                <button onClick={() => window.print()} type="button">
                  {t("arrival.print")}
                </button>
              </div>
              {message ? <p className={`arrivalPackMessage ${packState}`}>{message}</p> : null}
            </div>
          )}
        </aside>
      </section>
    </>
  );
}

export function renderArrivalPackHtml(packInput: ArrivalPack): string {
  const pack = ArrivalPackSchema.parse(packInput);
  const activities = pack.firstDay.blocks.length
    ? `<ol>${pack.firstDay.blocks
        .map(
          (block) =>
            `<li><strong>${escapeHtml(block.title)}</strong><span>${escapeHtml(
              formatBlockTime(block.startTime, block.endTime),
            )}</span></li>`,
        )
        .join("")}</ol>`
    : "<p>No first-day activities were available when this pack was generated.</p>";
  const addresses = pack.verifiedAddresses.length
    ? `<ul>${pack.verifiedAddresses
        .map(
          (address) =>
            `<li><strong>${escapeHtml(address.label)}</strong><br>${escapeHtml(
              address.localAddressZh,
            )}<br><small>Verified ${escapeHtml(formatDate(address.verifiedAt))}</small></li>`,
        )
        .join("")}</ul>`
    : "<p>No reviewed Chinese address receipt is included.</p>";

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(
    pack.tripTitle,
  )} | VisePanda Arrival Pack</title><style>body{color:#1d1613;font:16px/1.55 Arial,sans-serif;margin:0 auto;max-width:760px;padding:36px 24px}h1,h2{line-height:1.15}section{border-top:1px solid #d9cdbf;margin-top:28px;padding-top:18px}li{margin:10px 0}li span{color:#726862;display:block;font-size:13px}small{color:#726862}.notice{background:#f8ece8;border-left:3px solid #bd1e2d;padding:14px}</style></head>
<body><p>VisePanda · Offline arrival reference</p><h1>${escapeHtml(pack.tripTitle)}</h1><p>Generated ${escapeHtml(formatDate(pack.generatedAt))}. Review time-sensitive details before acting. This file is not live booking, payment, map, or emergency service data.</p>
<section><h2>First day</h2>${activities}</section><section><h2>Reviewed Chinese addresses</h2>${addresses}</section><section><h2>Emergency boundary</h2><p class="notice">For immediate danger or serious illness, contact the appropriate official emergency service now. Do not wait for VisePanda.</p></section><section><h2>Pack details</h2><p>Trip version ${pack.tripVersion} · Tools v${pack.contentVersions.tools} · Phrase pack ${escapeHtml(pack.contentVersions.phrasePack ?? "not included")}</p></section></body></html>`;
}

function readSavedArrivalPack(storage: Storage): ArrivalPack | null {
  try {
    const serialized = storage.getItem(ARRIVAL_PACK_STORAGE_KEY);
    if (!serialized) return null;
    const pack = ArrivalPackSchema.parse(JSON.parse(serialized) as unknown);
    return Date.parse(pack.expiresAt) > Date.now() ? pack : null;
  } catch {
    return null;
  }
}

function arrivalPackTelemetryProps(pack: ArrivalPack) {
  return {
    packVersion: pack.version,
    firstDayBlockCount: pack.firstDay.blocks.length,
    reviewedAddressCount: pack.verifiedAddresses.length,
    readinessIncluded: pack.readiness !== null,
  } as const;
}

function formatBlockTime(startTime: string | null, endTime: string | null): string {
  if (startTime && endTime) return `${startTime} – ${endTime}`;
  if (startTime) return startTime;
  if (endTime) return `Until ${endTime}`;
  return "Time not provided";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "'":
        return "&#39;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
