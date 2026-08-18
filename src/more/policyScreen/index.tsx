import * as React from "react";
import { View } from "react-native";

import Container from "components/Container";
import {
  StyleService,
  TopNavigation,
  useStyleSheet,
  Button,
} from "@ui-kitten/components";
import Content from "components/Content";
import Text from "components/Text";
import Flex from "components/Flex";
import SegmentedTabBar from "components/SegmentedTabBar";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { RouteProp, useRoute } from "@react-navigation/native";
import NavigationAction from "components/NavigationAction";
import { SkeletonList } from 'components/Skeleton';
import * as contentService from "services/contentService";
import { LegalSlug } from "services/contentService";
import { RootStackParamList } from "navigation/types";

// Was static, hardcoded placeholder copy ("TODO: replace with real legal
// text") with no way to update it short of an app-store release. Now fetches
// real, admin-editable content from the backend (services/contentService.ts,
// GET /api/v1/content/legal/{slug}) — an admin can update the actual wording
// from the dashboard's Content page at any time, and this screen picks it up
// on next open. Bundles both Privacy Policy and Terms of Service behind a
// simple tab switcher rather than requiring two separate menu entries/routes,
// since MoreSrc.tsx only ever had the one "Privacy of Policy" entry point.
// BUG FIX (product report: "privacy & terms screen" still showing English
// regardless of language) — these tab labels were plain string literals
// rendered directly at {tab.label} with no t() call at all.
const TABS: { key: LegalSlug; labelKey: string; labelDefault: string }[] = [
  { key: "privacy_policy", labelKey: "auth:privacy_policy", labelDefault: "Privacy Policy" },
  { key: "terms_of_service", labelKey: "common:terms_of_service", labelDefault: "Terms of Service" },
];

// Very small markdown-lite renderer — this content is admin-authored plain
// markdown (#/## headers, "- " bullets, plain paragraphs); pulling in a full
// markdown-rendering dependency for a couple of heading levels and bullets
// felt like overkill, so this just maps line-by-line instead.
function renderMarkdownLite(bodyMd: string, styles: any) {
  const lines = bodyMd.split("\n");
  const blocks: React.ReactNode[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = (key: string) => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;
    blocks.push(
      <Text key={key} category="h9-s" mb={16} style={styles.paragraph}>
        {text}
      </Text>,
    );
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      flushParagraph(`p${i}`);
      blocks.push(
        <Text key={`h2-${i}`} category="h6" bold mt={16} mb={8}>
          {line.replace(/^##\s+/, "")}
        </Text>,
      );
    } else if (line.startsWith("# ")) {
      flushParagraph(`p${i}`);
      blocks.push(
        <Text key={`h1-${i}`} category="h3" bold mb={12}>
          {line.replace(/^#\s+/, "")}
        </Text>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph(`p${i}`);
      blocks.push(
        <Text key={`li-${i}`} category="h9-s" mb={6} style={styles.bullet}>
          {"•  "}
          {line.replace(/^[-*]\s+/, "").replace(/\*\*/g, "")}
        </Text>,
      );
    } else if (!line) {
      flushParagraph(`p${i}`);
    } else {
      paragraphBuffer.push(line.replace(/\*\*/g, ""));
    }
  });
  flushParagraph("p-last");
  return blocks;
}

const PolicyScreen = () => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(["common", "auth"]);
  // Optional deep-link into a specific tab (see navigation/types.tsx's
  // PolicyScreen param doc) — the signup/login Terms & Privacy acceptance
  // link opens straight to "terms_of_service" instead of always landing on
  // Privacy Policy. route.params is undefined for every other existing
  // caller (MoreSrc's plain "Privacy of Policy" entry), which is exactly
  // why this still defaults to "privacy_policy" below.
  const route = useRoute<RouteProp<RootStackParamList, "PolicyScreen">>();

  const [activeTab, setActiveTab] = React.useState<LegalSlug>(
    route.params?.initialTab ?? "privacy_policy",
  );
  const [content, setContent] = React.useState<Record<LegalSlug, contentService.LegalContent | null>>({
    privacy_policy: null,
    terms_of_service: null,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const load = React.useCallback(async (slug: LegalSlug) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await contentService.getLegalContent(slug);
      setContent(prev => ({ ...prev, [slug]: result }));
    } catch (e: any) {
      setLoadError(e?.message ?? t("common:could_not_load_content", { defaultValue: "Could not load this content." }));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (!content[activeTab]) {
      load(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // BUG FIX (pre-launch i18n staleness audit — "once language changes all
  // content must change to that language whether the content was there
  // before language switch or not"): contentService.getLegalContent(slug)
  // is translated server-side per the current language, but once a slug
  // was cached in `content[slug]` above the `if (!content[activeTab])`
  // guard just above meant it was NEVER re-fetched again for the rest of
  // this screen's lifetime — switching language while already on this
  // screen (or having visited it earlier this session) left the Privacy
  // Policy/Terms text stuck in whatever language was active on first
  // fetch. Clearing the whole cache on a language change lets that same
  // guard naturally re-fetch both tabs the next time each is viewed.
  React.useEffect(() => {
    const onLanguageChanged = () => {
      setContent({ privacy_policy: null, terms_of_service: null });
    };
    i18n.on("languageChanged", onLanguageChanged);
    return () => {
      i18n.off("languageChanged", onLanguageChanged);
    };
  }, []);

  const current = content[activeTab];

  return (
    <Container>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t("auth:privacy_policy")}
      />
      {/* Task #64 (restyle all tab screens to the reference segmented-tab
          look) — this used to be its own bespoke two-button row (bottom
          border indicator, bold+link active / placeholder inactive text),
          which already coincidentally matched the reference's shape
          closely; swapped for the actual shared component
          (components/SegmentedTabBar.tsx) so every tab bar in the app is
          now pixel-for-pixel the same widget instead of independently
          hand-rolled per screen. */}
      <SegmentedTabBar
        tabs={TABS.map(tab => t(tab.labelKey, { defaultValue: tab.labelDefault }))}
        activeIndex={TABS.findIndex(tab => tab.key === activeTab)}
        onChange={i => setActiveTab(TABS[i].key)}
      />
      <Content contentContainerStyle={styles.content}>
        {isLoading && !current ? (
          <SkeletonList count={3} style={{ paddingHorizontal: 16 }} />
        ) : loadError && !current ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {loadError}
            </Text>
            <Button size="small" onPress={() => load(activeTab)}>
              {t("common:try_again", { defaultValue: "Try again" })}
            </Button>
          </Flex>
        ) : current ? (
          <View>{renderMarkdownLite(current.bodyMd, styles)}</View>
        ) : null}
      </Content>
    </Container>
  );
};
export default PolicyScreen;

const themedStyles = StyleService.create({
  content: {
    padding: 24,
  },
  paragraph: {
    lineHeight: 22,
  },
  bullet: {
    lineHeight: 22,
    marginLeft: 4,
  },
});
