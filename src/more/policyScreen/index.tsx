import * as React from "react";

import Container from "components/Container";
import {
  Layout,
  StyleService,
  TopNavigation,
  useStyleSheet,
} from "@ui-kitten/components";
import Content from "components/Content";
import Text from "components/Text";
import { useTranslation } from "react-i18next";
import NavigationAction from "components/NavigationAction";

const PolicyScreen = () => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(["common", "auth"]);
  // TODO: placeholder privacy-policy copy — replace with real legal text.
  const dataWeCollect = [
    "• Mock interview recordings & transcripts",
    "• Resume, cover letter & transcript uploads",
    "• Job application tracking details",
    "• Account & profile information",
    "• Interview performance scores",
    "• App usage analytics",
  ];
  const yourRights = [
    "• Export your data at any time",
    "• Delete your account & data",
    "• Opt out of usage analytics",
    "• Update your profile anytime",
    "• Control notification preferences",
    "• Request human support",
  ];
  return (
    <Container>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t("auth:privacy_policy")}
      />
      <Content contentContainerStyle={styles.content}>
        <Text category="h3">{"Your Privacy"}</Text>
        <Text>{`We collect only what's needed to personalize your mock interviews, resume feedback and job-application tracking. Your practice recordings and uploaded documents are never shared with third parties without your permission.`}</Text>
        <Text category="h3">{"Data We Collect"}</Text>
        <Layout style={{ gap: 12 }}>
          {dataWeCollect.map((item, index) => (
            <Text key={index}>{item}</Text>
          ))}
        </Layout>
        <Text category="h3">{"Your Rights"}</Text>
        <Layout style={{ gap: 12 }}>
          {yourRights.map((item, index) => (
            <Text key={index}>{item}</Text>
          ))}
        </Layout>
      </Content>
    </Container>
  );
};
export default PolicyScreen;

const themedStyles = StyleService.create({
  content: {
    padding: 24,
    gap: 24,
  },
});
