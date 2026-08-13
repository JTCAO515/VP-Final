import { useEffect, useState } from "react";
import * as Clipboard from "expo-clipboard";
import * as Speech from "expo-speech";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  isAvailableShowToLocalPhrase,
  createOfflineMobileCache,
  isOfflineTripPackageCurrent,
  SHOW_TO_LOCAL_PHRASE_PACK,
  TOOLS_CONTENT_PACK,
  type OfflineMobileCache,
  type ShowToLocalPhrasePack,
  type ShowToLocalPhraseCard,
  type ToolsContentPack,
} from "@visepanda/domain";

import { mobileTheme } from "./src/index";
import { createNativeOfflineCacheStore } from "./src/offline-cache.native";
import type { OfflineCacheLoadResult } from "./src/offline-cache";
import { MOBILE_TAB_LABELS, MOBILE_TABS, type MobileTab } from "./src/shell";
import { canCopyOrSpeakShowToLocalCard, showToLocalAccessibilityLabel } from "./src/show-to-local";

const offlineCacheStore = createNativeOfflineCacheStore();

export default function App() {
  const [activeTab, setActiveTab] = useState<MobileTab>("today");
  const [showToLocalOpen, setShowToLocalOpen] = useState(false);
  const [offlineCache, setOfflineCache] = useState<OfflineCacheLoadResult | null>(null);
  const [offlineCacheNotice, setOfflineCacheNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadOfflineCache();
  }, []);

  async function loadOfflineCache() {
    const result = await offlineCacheStore.load();
    setOfflineCache(result);
    if (result.kind === "corrupted_cleared") {
      setOfflineCacheNotice(
        "A corrupted local cache was cleared. Refresh to save this build again.",
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
          {activeTab === "today" ? <TodayView cache={cachedContent} /> : null}
          {activeTab === "tools" && showToLocalOpen ? (
            <ShowToLocalView onBack={() => setShowToLocalOpen(false)} phrasePack={phrasePack} />
          ) : null}
          {activeTab === "tools" && !showToLocalOpen ? (
            <ToolsView
              cache={offlineCache}
              notice={offlineCacheNotice}
              onClearCache={() => void clearOfflineCache()}
              onOpenShowToLocal={() => setShowToLocalOpen(true)}
              onRefreshCache={() => void refreshOfflineCache()}
              toolsContent={toolsContent}
            />
          ) : null}
          {activeTab === "help" ? <HelpView /> : null}
          {activeTab === "me" ? <MeView /> : null}
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

function TodayView({ cache }: { cache: OfflineMobileCache | null }) {
  const cachedTrip = cache?.tripPackage ?? null;
  const tripCurrent = cachedTrip ? isOfflineTripPackageCurrent(cachedTrip) : false;

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Today
      </Text>
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
        </View>
      ) : (
        <>
          <Text style={styles.body}>
            Your current Trip will appear here when a future read-only sync is configured.
          </Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {cachedTrip
                ? "The saved Trip has expired. Refresh after a read-only sync is available."
                : "No Trip is connected in this build."}
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
  phrasePack,
}: {
  onBack: () => void;
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

function HelpView() {
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
          Human Help availability is not connected in this build. No request has been submitted.
        </Text>
      </View>
    </View>
  );
}

function MeView() {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Me
      </Text>
      <Text style={styles.body}>
        Account and entitlement state are not connected in this build.
      </Text>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>No account data is stored by this shell.</Text>
      </View>
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
  copyStatus: { color: components.status.info.color, fontSize: typography.sizes.sm },
});
