import * as React from "react";
import {Linking} from "react-native";
import Container from "components/Container";
import Text from "components/Text";
import {StyleService, TopNavigation, useStyleSheet, useTheme, Layout, Icon} from "@ui-kitten/components";
import NavigationAction from "components/NavigationAction";
import {useTranslation} from "react-i18next";
import Content from "components/Content";
import Flex from "components/Flex";
import {globalStyle} from "styles/globalStyle";
import * as configService from "services/configService";

// Real About content, admin-editable (product request item) — this screen
// used to link to the original template author's own CodeCanyon portfolio
// and a stranger's Messenger contact instead of anything about this app.
// Content now comes from configService's cached app config (see
// saveur-backend's app_config_service.py's "about" section and the admin
// dashboard's Content page).
const AboutScreen = () => {
  const theme = useTheme();
  const {t} = useTranslation(["common", "auth"]);
  const styles = useStyleSheet(themedStyles);
  const about = configService.getCachedConfig().about;
  const version = configService.APP_VERSION;

  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={() => <NavigationAction />} title={t("auth:about", {defaultValue: "About"})} />
      <Content contentContainerStyle={styles.content}>
        <Flex vertical itemsCenter style={styles.hero}>
          <Text category="h3" bold center>
            {t("auth:app_name", {defaultValue: "Saveur"})}
          </Text>
          {about.tagline ? (
            <Text category="h9-s" status="placeholder" center mt={8}>
              {about.tagline}
            </Text>
          ) : null}
        </Flex>

        {about.description ? (
          <Layout level="2" style={styles.card}>
            <Text category="h9-s">{about.description}</Text>
          </Layout>
        ) : null}

        {about.contact_email || about.website_url ? (
          <Layout level="2" style={styles.card}>
            <Text category="h8" bold mb={12}>
              {t("auth:contact_us", {defaultValue: "Contact Us"})}
            </Text>
            {about.contact_email ? (
              <Flex
                justify="flex-start"
                itemsCenter
                mb={about.website_url ? 10 : 0}
                onPress={() => Linking.openURL(`mailto:${about.contact_email}`).catch(() => {})}>
                <Icon pack="eva" name="email-outline" style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]} />
                <Text category="h9-s" ml={10} status="info">
                  {about.contact_email}
                </Text>
              </Flex>
            ) : null}
            {about.website_url ? (
              <Flex justify="flex-start" itemsCenter onPress={() => Linking.openURL(about.website_url).catch(() => {})}>
                <Icon pack="eva" name="globe-outline" style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]} />
                <Text category="h9-s" ml={10} status="info">
                  {about.website_url}
                </Text>
              </Flex>
            ) : null}
          </Layout>
        ) : null}

        <Text category="h10" status="placeholder" center mt={12}>
          {t("auth:version_label", {defaultValue: "Version {{version}}", version})}
        </Text>
      </Content>
    </Container>
  );
};

export default AboutScreen;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  hero: {
    marginBottom: 20,
  },
  card: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
});
