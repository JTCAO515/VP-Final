import { useEffect, useRef, useState } from "react";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  isAvailableShowToLocalPhrase,
  createOfflineMobileCache,
  isOfflineTripPackageCurrent,
  SHOW_TO_LOCAL_PHRASE_PACK,
  TOOLS_CONTENT_PACK,
  type OfflineMobileCache,
  type ReadOnlyTripSnapshot,
  type ShowToLocalPhrasePack,
  type ShowToLocalPhraseCard,
  type ToolsContentPack,
  type HumanTaskCreate,
  type HumanTaskKind,
  type HumanTaskReceipt,
} from "@visepanda/domain";

import { mobileTheme } from "./src/index";
import { createNativeOfflineCacheStore } from "./src/offline-cache.native";
import type { OfflineCacheLoadResult } from "./src/offline-cache";
import { readMobileAuthConfig } from "./src/mobile-auth";
import { createMobileAuthClient } from "./src/mobile-auth-client.native";
import {
  createReadOnlyTripOfflineCache,
  fetchMobileTrips,
  MobileTripSyncError,
  readMobileWebBaseUrl,
} from "./src/mobile-trip-sync";
import {
  createMobileHumanHelpIdempotencyKey,
  MobileHumanHelpError,
  submitMobileHumanHelp,
} from "./src/mobile-human-help";
import {
  createMobileTelemetryEvent,
  createMobileTelemetryQueue,
  enqueueMobileTelemetry,
  flushMobileTelemetryQueue,
  MobileTelemetryQueueFullError,
  type MobileTelemetryQueue,
} from "./src/mobile-telemetry";
import { createNativeMobileTelemetryQueueStore } from "./src/mobile-telemetry-store.native";
import { MOBILE_TAB_LABELS, MOBILE_TABS, type MobileTab } from "./src/shell";
import { canCopyOrSpeakShowToLocalCard, showToLocalAccessibilityLabel } from "./src/show-to-local";

const offlineCacheStore = createNativeOfflineCacheStore();
const mobileTelemetryQueueStore = createNativeMobileTelemetryQueueStore();
const mobileAuthConfig = readMobileAuthConfig(process.env);
const mobileAuthClient = mobileAuthConfig ? createMobileAuthClient(mobileAuthConfig) : null;
const mobileWebBaseUrl = readMobileWebBaseUrl(process.env);

type MobileSession = { accessToken: string; email: string | null; userId: string };
type MobileHumanHelpDraft = HumanTaskCreate;

const EMPTY_HUMAN_HELP_DRAFT: MobileHumanHelpDraft = {
  city: "Shanghai",
  kind: "other",
  description: "",
  contact: "",
};

const HUMAN_HELP_KIND_OPTIONS: ReadonlyArray<{ kind: HumanTaskKind; label: string }> = [
  { kind: "transport_help", label: "Transport" },
  { kind: "translation_help", label: "Translation" },
  { kind: "ticket_help", label: "Tickets" },
  { kind: "call_restaurant", label: "Restaurant" },
  { kind: "other", label: "Other" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<MobileTab>("today");
  const [showToLocalOpen, setShowToLocalOpen] = useState(false);
  const [offlineCache, setOfflineCache] = useState<OfflineCacheLoadResult | null>(null);
  const [offlineCacheNotice, setOfflineCacheNotice] = useState<string | null>(null);
  const [mobileSession, setMobileSession] = useState<MobileSession | null>(null);
  const [mobileTrips, setMobileTrips] = useState<ReadonlyArray<ReadOnlyTripSnapshot>>([]);
  const [tripSyncNotice, setTripSyncNotice] = useState<string | null>(null);
  const [tripSyncing, setTripSyncing] = useState(false);
  const [mobileTelemetryQueue, setMobileTelemetryQueue] = useState<MobileTelemetryQueue>(
    createMobileTelemetryQueue(),
  );
  const [mobileTelemetryReady, setMobileTelemetryReady] = useState(false);
  const [openedSessionUserId, setOpenedSessionUserId] = useState<string | null>(null);
  const [humanHelpDraft, setHumanHelpDraft] =
    useState<MobileHumanHelpDraft>(EMPTY_HUMAN_HELP_DRAFT);
  const [humanHelpIdempotencyKey, setHumanHelpIdempotencyKey] = useState(
    createMobileHumanHelpIdempotencyKey,
  );
  const mobileTelemetryQueueRef = useRef(mobileTelemetryQueue);
  mobileTelemetryQueueRef.current = mobileTelemetryQueue;

  useEffect(() => {
    void loadOfflineCache();
    void loadMobileTelemetryQueue();
  }, []);

  useEffect(() => {
    if (!mobileAuthClient) return;
    let active = true;

    void mobileAuthClient.auth.getSession().then(({ data }) => {
      if (!active) return;
      setMobileSession(sessionForMobile(data.session));
      if (!data.session) setMobileTrips([]);
    });
    const { data } = mobileAuthClient.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setMobileSession(sessionForMobile(session));
      if (!session) setMobileTrips([]);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!mobileSession) {
      if (openedSessionUserId) setOpenedSessionUserId(null);
      return;
    }
    if (!mobileTelemetryReady || openedSessionUserId === mobileSession.userId) return;
    setOpenedSessionUserId(mobileSession.userId);
    void queueMobileTelemetry({ action: "app_opened", entity_type: "mobile_app" });
  }, [mobileSession?.userId, mobileTelemetryReady, openedSessionUserId]);

  useEffect(() => {
    if (!mobileSession || !mobileWebBaseUrl || mobileTelemetryQueue.events.length === 0) return;
    void flushMobileTelemetry();
    const retry = setInterval(() => void flushMobileTelemetry(), 30_000);
    return () => clearInterval(retry);
  }, [mobileSession?.accessToken, mobileTelemetryQueue.events.length]);

  useEffect(() => {
    if (!mobileSession?.email) return;
    setHumanHelpDraft((draft) =>
      draft.contact ? draft : { ...draft, contact: mobileSession.email! },
    );
  }, [mobileSession?.email]);

  async function loadOfflineCache() {
    const result = await offlineCacheStore.load();
    setOfflineCache(result);
    if (result.kind === "corrupted_cleared") {
      setOfflineCacheNotice(
        "A corrupted local cache was cleared. Refresh to save this build again.",
      );
    }
  }

  async function loadMobileTelemetryQueue() {
    const result = await mobileTelemetryQueueStore.load();
    const queue = result.kind === "ready" ? result.queue : createMobileTelemetryQueue();
    mobileTelemetryQueueRef.current = queue;
    setMobileTelemetryQueue(queue);
    setMobileTelemetryReady(true);
    if (result.kind === "corrupted_cleared") {
      setOfflineCacheNotice(
        "A corrupted local telemetry queue was cleared. No Trip or Tool content changed.",
      );
    }
  }

  async function refreshOfflineCache() {
    const tripPackage = offlineCache?.kind === "ready" ? offlineCache.cache.tripPackage : null;
    const cache = createOfflineMobileCache({
      refreshedAt: new Date(),
      tripPackage,
      toolsContent: TOOLS_CONTENT_PACK,
      phrasePack: SHOW_TO_LOCAL_PHRASE_PACK,
    });

    try {
      await offlineCacheStore.save(cache);
      setOfflineCache({ kind: "ready", cache });
      setOfflineCacheNotice(
        tripPackage
          ? "Local Trip, Tools, and phrase cards refreshed."
          : "Local Tools and phrase cards refreshed. No Trip is connected yet.",
      );
    } catch {
      setOfflineCacheNotice(
        "Local refresh is unavailable. Existing cached content was not changed.",
      );
    }
  }

  async function clearOfflineCache() {
    try {
      await offlineCacheStore.clear();
      setOfflineCache({ kind: "empty" });
      setOfflineCacheNotice("Local cache cleared.");
    } catch {
      setOfflineCacheNotice("Local cache could not be cleared. Try again before relying on it.");
    }
  }

  async function queueMobileTelemetry(input: Parameters<typeof createMobileTelemetryEvent>[0]) {
    try {
      const nextQueue = enqueueMobileTelemetry(
        mobileTelemetryQueueRef.current,
        createMobileTelemetryEvent(input),
      );
      await mobileTelemetryQueueStore.save(nextQueue);
      mobileTelemetryQueueRef.current = nextQueue;
      setMobileTelemetryQueue(nextQueue);
      if (mobileSession && mobileWebBaseUrl) void flushMobileTelemetry(nextQueue);
    } catch (error) {
      if (error instanceof MobileTelemetryQueueFullError) {
        setOfflineCacheNotice(
          "Mobile telemetry storage is full. Product actions continue without recording a new observation.",
        );
      } else {
        setOfflineCacheNotice(
          "Mobile telemetry could not be saved locally. Product actions continue without recording a new observation.",
        );
      }
    }
  }

  async function flushMobileTelemetry(queue = mobileTelemetryQueueRef.current) {
    if (!mobileSession || !mobileWebBaseUrl || queue.events.length === 0) return;
    try {
      const nextQueue = await flushMobileTelemetryQueue({
        accessToken: mobileSession.accessToken,
        baseUrl: mobileWebBaseUrl,
        queue,
      });
      if (
        nextQueue.events.length !== queue.events.length &&
        mobileTelemetryQueueRef.current === queue
      ) {
        await mobileTelemetryQueueStore.save(nextQueue);
        mobileTelemetryQueueRef.current = nextQueue;
        setMobileTelemetryQueue(nextQueue);
      }
    } catch {
      // Retry is scheduled only while a verified session and queued event remain available.
    }
  }

  async function syncTrips() {
    if (!mobileSession) {
      setTripSyncNotice("Sign in in Me to load your Web Trips.");
      setActiveTab("me");
      return;
    }
    if (!mobileWebBaseUrl) {
      setTripSyncNotice(
        "Trip sync is unavailable in this build. Your offline Trip was not changed.",
      );
      return;
    }

    setTripSyncing(true);
    setTripSyncNotice(null);
    try {
      const trips = await fetchMobileTrips({
        accessToken: mobileSession.accessToken,
        baseUrl: mobileWebBaseUrl,
      });
      setMobileTrips(trips);
      setTripSyncNotice(
        trips.length === 0
          ? "No Web Trips are available for this account yet."
          : "Choose a Trip below to save a read-only offline copy.",
      );
    } catch (error) {
      if (error instanceof MobileTripSyncError && error.code === "MOBILE_SESSION_INVALID") {
        await mobileAuthClient?.auth.signOut();
      }
      setTripSyncNotice(
        error instanceof MobileTripSyncError
          ? error.message
          : "Trip sync is unavailable. Your existing offline Trip was not changed.",
      );
    } finally {
      setTripSyncing(false);
    }
  }

  async function saveReadOnlyTrip(snapshot: (typeof mobileTrips)[number]) {
    const savedAt = new Date();
    const cache = createReadOnlyTripOfflineCache(snapshot, savedAt);
    try {
      await offlineCacheStore.save(cache);
      setOfflineCache({ kind: "ready", cache });
      setOfflineCacheNotice("Read-only Trip saved for offline access for seven days.");
      setTripSyncNotice(`Saved ${snapshot.trip.title} for offline access.`);
      void queueMobileTelemetry({
        action: "trip_opened",
        entity_type: "trip",
        entity_id: snapshot.trip.id,
        props_jsonb: { version: snapshot.version },
      });
    } catch {
      setTripSyncNotice("The Trip could not be saved. Your existing offline Trip was not changed.");
    }
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    if (!mobileAuthClient) return "Mobile sign-in is unavailable in this build.";
    const { error } = await mobileAuthClient.auth.signInWithPassword({ email, password });
    return error ? "Sign-in failed. Check your email and password, then try again." : null;
  }

  async function signOut(): Promise<void> {
    if (!mobileAuthClient) return;
    const { error } = await mobileAuthClient.auth.signOut();
    if (!error) {
      setMobileTrips([]);
      const emptyQueue = createMobileTelemetryQueue();
      mobileTelemetryQueueRef.current = emptyQueue;
      setMobileTelemetryQueue(emptyQueue);
      try {
        await mobileTelemetryQueueStore.save(emptyQueue);
      } catch {
        setOfflineCacheNotice(
          "Unsent mobile telemetry was cleared from this session, but local storage could not be confirmed.",
        );
      }
    }
    setTripSyncNotice(
      error
        ? "Sign-out could not be completed. Try again."
        : "Signed out. Offline content remains on this device; unsent product observations were cleared.",
    );
  }

  function openHumanHelp(description = "") {
    setHumanHelpDraft((draft) => ({
      ...draft,
      ...(description && !draft.description.trim() ? { description } : {}),
      ...(!draft.contact && mobileSession?.email ? { contact: mobileSession.email } : {}),
    }));
    setActiveTab("help");
  }

  async function submitHumanHelp(): Promise<HumanTaskReceipt | null> {
    if (!mobileSession) {
      setActiveTab("me");
      return null;
    }
    if (!mobileWebBaseUrl) return null;
    try {
      const receipt = await submitMobileHumanHelp({
        accessToken: mobileSession.accessToken,
        baseUrl: mobileWebBaseUrl,
        request: humanHelpDraft,
        idempotencyKey: humanHelpIdempotencyKey,
      });
      void queueMobileTelemetry({
        action: "human_help_submitted",
        entity_type: "human_task",
      });
      setHumanHelpDraft((draft) => ({ ...EMPTY_HUMAN_HELP_DRAFT, contact: draft.contact }));
      setHumanHelpIdempotencyKey(createMobileHumanHelpIdempotencyKey());
      return receipt;
    } catch (error) {
      if (
        error instanceof MobileHumanHelpError &&
        error.code === "MOBILE_HUMAN_HELP_SESSION_INVALID"
      ) {
        await mobileAuthClient?.auth.signOut();
      }
      throw error;
    }
  }

  const cachedContent = offlineCache?.kind === "ready" ? offlineCache.cache : null;
  const toolsContent = cachedContent?.toolsContent ?? TOOLS_CONTENT_PACK;
  const phrasePack = cachedContent?.phrasePack ?? SHOW_TO_LOCAL_PHRASE_PACK;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.app}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.brand}>
            VisePanda
          </Text>
          <Text style={styles.subtitle}>China Travel AI Copilot</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {activeTab === "today" ? (
            <TodayView
              cache={cachedContent}
              canSync={Boolean(mobileSession && mobileWebBaseUrl)}
              notice={tripSyncNotice}
              onSaveTrip={(snapshot) => void saveReadOnlyTrip(snapshot)}
              onRequestHumanHelp={openHumanHelp}
              onSyncTrips={() => void syncTrips()}
              syncing={tripSyncing}
              trips={mobileTrips}
            />
          ) : null}
          {activeTab === "tools" && showToLocalOpen ? (
            <ShowToLocalView
              onBack={() => setShowToLocalOpen(false)}
              onSelectCard={(category) =>
                void queueMobileTelemetry({
                  action: "show_to_local_used",
                  entity_type: "show_to_local",
                  entity_id: category,
                  props_jsonb: { category },
                })
              }
              phrasePack={phrasePack}
            />
          ) : null}
          {activeTab === "tools" && !showToLocalOpen ? (
            <ToolsView
              cache={offlineCache}
              notice={offlineCacheNotice}
              onClearCache={() => void clearOfflineCache()}
              onOpenShowToLocal={() => {
                void queueMobileTelemetry({
                  action: "tool_opened",
                  entity_type: "tool",
                  entity_id: "translation",
                  props_jsonb: { tool: "translation" },
                });
                setShowToLocalOpen(true);
              }}
              onRefreshCache={() => void refreshOfflineCache()}
              toolsContent={toolsContent}
            />
          ) : null}
          {activeTab === "help" ? (
            <HelpView
              canSubmit={Boolean(mobileSession && mobileWebBaseUrl)}
              draft={humanHelpDraft}
              onDraftChange={setHumanHelpDraft}
              onRequireSignIn={() => setActiveTab("me")}
              onSubmit={submitHumanHelp}
              signedIn={Boolean(mobileSession)}
            />
          ) : null}
          {activeTab === "me" ? (
            <MeView
              accountEmail={mobileSession?.email ?? null}
              authConfigured={Boolean(mobileAuthClient)}
              onSignIn={signIn}
              onSignOut={() => void signOut()}
            />
          ) : null}
        </ScrollView>

        <View accessibilityRole="tablist" style={styles.tabBar}>
          {MOBILE_TABS.map((tab) => {
            const selected = activeTab === tab;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityLabel={MOBILE_TAB_LABELS[tab]}
                accessibilityState={{ selected }}
                key={tab}
                onPress={() => {
                  setActiveTab(tab);
                  setShowToLocalOpen(false);
                  if (tab === "tools") {
                    void queueMobileTelemetry({
                      action: "offline_content_used",
                      entity_type: "offline_content",
                      props_jsonb: { cacheVersion: 1 },
                    });
                  }
                }}
                style={[styles.tab, selected ? styles.tabSelected : null]}
              >
                <Text style={[styles.tabLabel, selected ? styles.tabLabelSelected : null]}>
                  {MOBILE_TAB_LABELS[tab]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function TodayView({
  cache,
  canSync,
  notice,
  onSaveTrip,
  onRequestHumanHelp,
  onSyncTrips,
  syncing,
  trips,
}: {
  cache: OfflineMobileCache | null;
  canSync: boolean;
  notice: string | null;
  onSaveTrip: (snapshot: ReadOnlyTripSnapshot) => void;
  onRequestHumanHelp: (description?: string) => void;
  onSyncTrips: () => void;
  syncing: boolean;
  trips: ReadonlyArray<ReadOnlyTripSnapshot>;
}) {
  const cachedTrip = cache?.tripPackage ?? null;
  const tripCurrent = cachedTrip ? isOfflineTripPackageCurrent(cachedTrip) : false;

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Today
      </Text>
      <View style={styles.offlineStatus}>
        <Text style={styles.offlineStatusTitle}>Read-only Trip sync</Text>
        <Text style={styles.offlineStatusText}>
          {canSync
            ? "Load Trips from your signed-in Web account, then choose one to save locally."
            : "Sign in in Me to load a Web Trip. This app never edits a Trip."}
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={syncing}
          onPress={onSyncTrips}
          style={[styles.primaryButton, syncing ? styles.buttonDisabled : null]}
        >
          <Text style={styles.primaryButtonText}>
            {syncing ? "Loading Trips…" : "Load Web Trips"}
          </Text>
        </Pressable>
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.offlineStatusText}>
            {notice}
          </Text>
        ) : null}
      </View>
      {trips.map((snapshot) => (
        <View key={snapshot.trip.id} style={styles.card}>
          <Text style={styles.cardTitle}>{snapshot.trip.title}</Text>
          <Text style={styles.cardBody}>
            Version {snapshot.version} · {snapshot.trip.days.length} day
            {snapshot.trip.days.length === 1 ? "" : "s"} · read-only
          </Text>
          <Pressable
            accessibilityLabel={`Save ${snapshot.trip.title} for offline access`}
            accessibilityRole="button"
            onPress={() => onSaveTrip(snapshot)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Save offline</Text>
          </Pressable>
        </View>
      ))}
      {cachedTrip && tripCurrent ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{cachedTrip.trip.title}</Text>
          <Text style={styles.cardBody}>
            Read-only cached Trip · {cachedTrip.trip.days.length} day
            {cachedTrip.trip.days.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.cardAction}>
            Last refreshed {formatOfflineTimestamp(cache?.refreshedAt ?? cachedTrip.savedAt)}
          </Text>
          <Pressable
            accessibilityLabel="Ask Human Help about this Trip"
            accessibilityRole="button"
            onPress={() => onRequestHumanHelp(humanHelpPrefillForTrip(cachedTrip.trip))}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Ask Human Help about this Trip</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.body}>Your saved read-only Trip will appear here.</Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {cachedTrip
                ? "The saved Trip has expired. Load the latest Trip before relying on it."
                : "No Trip is saved on this device yet."}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

function ToolsView({
  cache,
  notice,
  onClearCache,
  onOpenShowToLocal,
  onRefreshCache,
  toolsContent,
}: {
  cache: OfflineCacheLoadResult | null;
  notice: string | null;
  onClearCache: () => void;
  onOpenShowToLocal: () => void;
  onRefreshCache: () => void;
  toolsContent: ToolsContentPack;
}) {
  const persistedCache = cache?.kind === "ready" ? cache.cache : null;

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Tools
      </Text>
      <Text style={styles.body}>
        Local preparation content. It does not make live bookings or calls.
      </Text>
      <View style={styles.offlineStatus}>
        <Text style={styles.offlineStatusTitle}>Offline content</Text>
        <Text style={styles.offlineStatusText}>{offlineCacheSummary(cache)}</Text>
        {persistedCache ? (
          <Text style={styles.offlineStatusText}>
            Last refreshed {formatOfflineTimestamp(persistedCache.refreshedAt)}
          </Text>
        ) : null}
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.offlineStatusText}>
            {notice}
          </Text>
        ) : null}
        <View style={styles.phraseActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onRefreshCache}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Refresh local cache</Text>
          </Pressable>
          {persistedCache ? (
            <Pressable
              accessibilityRole="button"
              onPress={onClearCache}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Clear cache</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {toolsContent.items.map((item) => {
        const opensShowToLocal = item.id === "translation";
        const content = (
          <>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardBody}>{item.summary}</Text>
            <Text style={styles.cardAction}>
              {opensShowToLocal ? "Open Show to Local" : item.actionLabel}
            </Text>
          </>
        );

        return opensShowToLocal ? (
          <Pressable
            accessibilityLabel="Open Show to Local"
            accessibilityRole="button"
            key={item.id}
            onPress={onOpenShowToLocal}
            style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
          >
            {content}
          </Pressable>
        ) : (
          <View key={item.id} style={styles.card}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

function ShowToLocalView({
  onBack,
  onSelectCard,
  phrasePack,
}: {
  onBack: () => void;
  onSelectCard: (category: ShowToLocalPhraseCard["category"]) => void;
  phrasePack: ShowToLocalPhrasePack;
}) {
  const [selectedCard, setSelectedCard] = useState<ShowToLocalPhraseCard>(phrasePack.cards[0]!);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function copySelectedPhrase() {
    if (!isAvailableShowToLocalPhrase(selectedCard)) return;
    await Clipboard.setStringAsync(selectedCard.chineseText);
    setCopyStatus("Chinese phrase copied.");
  }

  function speakSelectedPhrase() {
    if (!isAvailableShowToLocalPhrase(selectedCard)) return;
    Speech.stop();
    Speech.speak(selectedCard.chineseText, { language: "zh-CN" });
  }

  return (
    <View style={styles.section}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back to Tools</Text>
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        Show to Local
      </Text>
      <Text style={styles.body}>
        Fixed offline cards for routine requests. High-risk requests require a current verified
        card.
      </Text>

      <View style={styles.phraseList}>
        {phrasePack.cards.map((card) => {
          const selected = card.id === selectedCard.id;
          return (
            <Pressable
              accessibilityLabel={showToLocalAccessibilityLabel(card)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={card.id}
              onPress={() => {
                setSelectedCard(card);
                setCopyStatus(null);
                onSelectCard(card.category);
              }}
              style={[styles.phraseChoice, selected ? styles.phraseChoiceSelected : null]}
            >
              <Text
                style={[
                  styles.phraseChoiceTitle,
                  selected ? styles.phraseChoiceTitleSelected : null,
                ]}
              >
                {card.title}
              </Text>
              <Text style={styles.phraseChoiceStatus}>
                {canCopyOrSpeakShowToLocalCard(card)
                  ? "Ready offline"
                  : "Verified card unavailable"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isAvailableShowToLocalPhrase(selectedCard) ? (
        <View style={styles.phraseDisplay}>
          <Text style={styles.phraseEnglish}>{selectedCard.englishText}</Text>
          <Text accessibilityLabel="Chinese phrase" style={styles.phraseChinese}>
            {selectedCard.chineseText}
          </Text>
          <View style={styles.phraseActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void copySelectedPhrase()}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Copy phrase</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={speakSelectedPhrase}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Speak locally</Text>
            </Pressable>
          </View>
          {copyStatus ? (
            <Text accessibilityLiveRegion="polite" style={styles.copyStatus}>
              {copyStatus}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.warning}>
          <Text style={styles.warningText}>{selectedCard.fallback}</Text>
        </View>
      )}
    </View>
  );
}

function HelpView({
  canSubmit,
  draft,
  onDraftChange,
  onRequireSignIn,
  onSubmit,
  signedIn,
}: {
  canSubmit: boolean;
  draft: MobileHumanHelpDraft;
  onDraftChange: (draft: MobileHumanHelpDraft) => void;
  onRequireSignIn: () => void;
  onSubmit: () => Promise<HumanTaskReceipt | null>;
  signedIn: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!signedIn) {
      setNotice("Sign in in Me before requesting Human Help.");
      onRequireSignIn();
      return;
    }
    if (!canSubmit) {
      setNotice("Human Help is unavailable in this build. Your request was not submitted.");
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const receipt = await onSubmit();
      setNotice(
        receipt
          ? `Request submitted. Keep this receipt: ${receipt.id}.`
          : "Sign in in Me before requesting Human Help.",
      );
    } catch (error) {
      setNotice(
        error instanceof MobileHumanHelpError
          ? error.message
          : "Human Help is temporarily unavailable. Your request was not submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Help
      </Text>
      <Text style={styles.body}>
        In an urgent situation, contact the appropriate official local service now. Do not wait for
        an app response.
      </Text>
      <View style={styles.warning}>
        <Text style={styles.warningText}>
          Shanghai preview only. Human Help is a best-effort, non-emergency request. It does not
          guarantee a response or replace local emergency services.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Request Human Help</Text>
        <Text style={styles.cardBody}>Your contact and request are sent only when you submit.</Text>
        <Text style={styles.inputLabel}>Request type</Text>
        <View style={styles.phraseList}>
          {HUMAN_HELP_KIND_OPTIONS.map((option) => {
            const selected = draft.kind === option.kind;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option.kind}
                onPress={() => onDraftChange({ ...draft, kind: option.kind })}
                style={[styles.phraseChoice, selected ? styles.phraseChoiceSelected : null]}
              >
                <Text
                  style={[
                    styles.phraseChoiceTitle,
                    selected ? styles.phraseChoiceTitleSelected : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.inputLabel}>What do you need help with?</Text>
        <TextInput
          accessibilityLabel="Human Help request"
          multiline
          onChangeText={(description) => onDraftChange({ ...draft, description })}
          placeholder="Describe the situation and what you need."
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.multilineInput]}
          value={draft.description}
        />
        <Text style={styles.inputLabel}>Contact email or phone</Text>
        <TextInput
          accessibilityLabel="Human Help contact"
          autoCapitalize="none"
          onChangeText={(contact) => onDraftChange({ ...draft, contact })}
          placeholder="How can the team reach you?"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={draft.contact}
        />
        <Pressable
          accessibilityRole="button"
          disabled={
            submitting || draft.description.trim().length < 10 || draft.contact.trim().length < 3
          }
          onPress={() => void submit()}
          style={[
            styles.primaryButton,
            submitting || draft.description.trim().length < 10 || draft.contact.trim().length < 3
              ? styles.buttonDisabled
              : null,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Submitting…" : "Submit request"}
          </Text>
        </Pressable>
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.warningText}>
            {notice}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MeView({
  accountEmail,
  authConfigured,
  onSignIn,
  onSignOut,
}: {
  accountEmail: string | null;
  authConfigured: boolean;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignOut: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitSignIn() {
    setSubmitting(true);
    setNotice(await onSignIn(email.trim(), password));
    setSubmitting(false);
  }

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Me
      </Text>
      {accountEmail ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Signed in as {accountEmail}</Text>
          <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      ) : authConfigured ? (
        <View style={styles.card}>
          <Text style={styles.cardBody}>
            Sign in with the same account you use on the Web to load read-only Trips.
          </Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={email}
          />
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete="password"
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Pressable
            accessibilityRole="button"
            disabled={submitting || !email.trim() || !password}
            onPress={() => void submitSignIn()}
            style={[
              styles.primaryButton,
              submitting || !email.trim() || !password ? styles.buttonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.warningText}>
              {notice}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Mobile sign-in is unavailable in this build.</Text>
        </View>
      )}
    </View>
  );
}

function offlineCacheSummary(cache: OfflineCacheLoadResult | null): string {
  if (cache === null) return "Checking device storage…";
  if (cache.kind === "ready") {
    return cache.cache.tripPackage
      ? "Trip, Tools, and Show to Local cards are stored on this device."
      : "Tools and Show to Local cards are stored on this device. No Trip is connected yet.";
  }
  if (cache.kind === "corrupted_cleared") return "A corrupted cache was cleared.";
  return "No local cache saved yet.";
}

function humanHelpPrefillForTrip(trip: ReadOnlyTripSnapshot["trip"]): string {
  const dayWithBlock = trip.days.find((day) => day.blocks.length > 0);
  const block = dayWithBlock?.blocks[0];
  if (!block) return `I need help with my saved Trip: ${trip.title}.`;
  const city = dayWithBlock?.city ? ` in ${dayWithBlock.city}` : "";
  return `I need help with ${block.title} on Day ${dayWithBlock?.dayNumber ?? 1}${city}.`;
}

function sessionForMobile(
  session: {
    access_token: string;
    user: { email?: string | null; id: string };
  } | null,
): MobileSession | null {
  return session
    ? {
        accessToken: session.access_token,
        email: session.user.email ?? null,
        userId: session.user.id,
      }
    : null;
}

function formatOfflineTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

const { colors, components, radii, spacing, typography } = mobileTheme;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.app },
  header: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  brand: { color: colors.ink, fontSize: typography.sizes.xl, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: typography.sizes.sm, marginTop: spacing[1] },
  content: { gap: spacing[4], padding: spacing[5], paddingBottom: spacing[8] },
  section: { gap: spacing[4] },
  title: { color: colors.ink, fontSize: typography.sizes["2xl"], fontWeight: "700" },
  body: { color: colors.inkSoft, fontSize: typography.sizes.md, lineHeight: 24 },
  card: {
    backgroundColor: components.card.backgroundColor,
    borderColor: components.card.borderColor,
    borderRadius: components.card.borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
    padding: spacing[4],
  },
  cardPressed: { opacity: 0.84 },
  cardTitle: { color: colors.ink, fontSize: typography.sizes.lg, fontWeight: "600" },
  cardBody: { color: colors.inkSoft, fontSize: typography.sizes.sm, lineHeight: 20 },
  cardAction: { color: colors.primary, fontSize: typography.sizes.sm, fontWeight: "600" },
  notice: {
    backgroundColor: components.status.info.backgroundColor,
    borderRadius: radii.sm,
    padding: spacing[4],
  },
  noticeText: { color: components.status.info.color, fontSize: typography.sizes.sm },
  warning: {
    backgroundColor: components.status.attention.backgroundColor,
    borderRadius: radii.sm,
    padding: spacing[4],
  },
  warningText: { color: components.status.attention.color, fontSize: typography.sizes.sm },
  offlineStatus: {
    backgroundColor: components.status.info.backgroundColor,
    borderRadius: radii.sm,
    gap: spacing[2],
    padding: spacing[4],
  },
  offlineStatusTitle: {
    color: components.status.info.color,
    fontSize: typography.sizes.md,
    fontWeight: "700",
  },
  offlineStatusText: {
    color: components.status.info.color,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  tab: {
    alignItems: "center",
    borderRadius: radii.sm,
    flex: 1,
    justifyContent: "center",
    minHeight: components.button.minHeight,
  },
  tabSelected: { backgroundColor: colors.surfaceRed },
  tabLabel: { color: colors.muted, fontSize: typography.sizes.xs, fontWeight: "600" },
  tabLabelSelected: { color: colors.primary },
  backButton: {
    alignSelf: "flex-start",
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: components.button.minHeight,
    paddingHorizontal: spacing[4],
  },
  backButtonText: { color: colors.ink, fontSize: typography.sizes.sm, fontWeight: "600" },
  phraseList: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  phraseChoice: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    gap: spacing[1],
    minHeight: components.button.minHeight,
    padding: spacing[3],
  },
  phraseChoiceSelected: { backgroundColor: colors.surfaceRed, borderColor: colors.primary },
  phraseChoiceTitle: { color: colors.ink, fontSize: typography.sizes.sm, fontWeight: "600" },
  phraseChoiceTitleSelected: { color: colors.primary },
  phraseChoiceStatus: { color: colors.muted, fontSize: typography.sizes.xs },
  phraseDisplay: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: components.card.borderRadius,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[4],
    padding: spacing[5],
  },
  phraseEnglish: { color: colors.inkSoft, fontSize: typography.sizes.md, lineHeight: 24 },
  phraseChinese: { color: colors.ink, fontSize: 30, fontWeight: "700", lineHeight: 42 },
  phraseActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    justifyContent: "center",
    minHeight: components.button.minHeight,
    paddingHorizontal: spacing[4],
  },
  primaryButtonText: { color: colors.surface, fontSize: typography.sizes.sm, fontWeight: "700" },
  buttonDisabled: { opacity: 0.48 },
  secondaryButton: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: components.button.minHeight,
    paddingHorizontal: spacing[4],
  },
  secondaryButtonText: { color: colors.ink, fontSize: typography.sizes.sm, fontWeight: "600" },
  input: {
    borderColor: colors.line,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontSize: typography.sizes.md,
    minHeight: components.button.minHeight,
    paddingHorizontal: spacing[3],
  },
  inputLabel: { color: colors.ink, fontSize: typography.sizes.sm, fontWeight: "600" },
  multilineInput: { minHeight: 108, paddingTop: spacing[3], textAlignVertical: "top" },
  copyStatus: { color: components.status.info.color, fontSize: typography.sizes.sm },
});
