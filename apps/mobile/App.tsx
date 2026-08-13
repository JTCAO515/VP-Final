import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { TOOLS_CONTENT_PACK } from "@visepanda/domain";

import { mobileTheme } from "./src/index";
import { MOBILE_TAB_LABELS, MOBILE_TABS, type MobileTab } from "./src/shell";

export default function App() {
  const [activeTab, setActiveTab] = useState<MobileTab>("today");

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
          {activeTab === "today" ? <TodayView /> : null}
          {activeTab === "tools" ? <ToolsView /> : null}
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
                onPress={() => setActiveTab(tab)}
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

function TodayView() {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Today
      </Text>
      <Text style={styles.body}>
        Your current Trip will appear here when a future read-only sync is configured.
      </Text>
      <View style={styles.notice}>
        <Text style={styles.noticeText}>No Trip is connected in this build.</Text>
      </View>
    </View>
  );
}

function ToolsView() {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Tools
      </Text>
      <Text style={styles.body}>
        Local preparation content. It does not make live bookings or calls.
      </Text>
      {TOOLS_CONTENT_PACK.items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardBody}>{item.summary}</Text>
          <Text style={styles.cardAction}>{item.actionLabel}</Text>
        </View>
      ))}
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
});
