import * as React from "react";
import { View } from "react-native";

import Container from "components/Container";
import {
  StyleService,
  TopNavigation,
  useStyleSheet,
  useTheme,
  Spinner,
  Button,
} from "@ui-kitten/components";
import Content from "components/Content";
import Text from "components/Text";
import Flex from "components/Flex";
import { useTranslation } from "react-i18next";
import { RouteProp, useRoute } from "@react-navigation/native";
import NavigationAction from "components/NavigationAction";
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
const TABS: { key: LegalSlug; label: string }[] = [
  { key: "privacy_policy", label: "Privacy Policy" },
  { key: "terms_of_service", label: "Terms of Service" },
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
        <Text key={`h1-${i}`} category="h4" bold mb={12}>
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
  const theme = useTheme();
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
      setLoadError(e?.message ?? "Could not load this content.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!content[activeTab]) {
      load(activeTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const current = content[activeTab];

  return (
    <Container>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t("auth:privacy_policy")}
      />
      <View style={styles.tabRow}>
        {TABS.map(tab => {
          const active = tab.key === activeTab;
          return (
            <Flex
              key={tab.key}
              center
              style={[
                styles.tabBtn,
                { borderBottomColor: active ? theme["color-primary-500"] : "transparent" },
              ]}
              onPress={() => setActiveTab(tab.key)}>
              <Text category="h9" bold status={active ? "link" : "placeholder"}>
                {tab.label}
              </Text>
            </Flex>
          );
        })}
      </View>
      <Content contentContainerStyle={styles.content}>
        {isLoading && !current ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
          </Flex>
        ) : loadError && !current ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {loadError}
            </Text>
            <Button size="small" onPress={() => load(activeTab)}>
              Try again
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
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "background-basic-color-3",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    borderBottomWidth: 2,
  },
  paragraph: {
    lineHeight: 22,
  },
  bullet: {
    lineHeight: 22,
    marginLeft: 4,
  },
});
