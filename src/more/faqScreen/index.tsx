import * as React from "react";
import {StyleService, TopNavigation, useStyleSheet, useTheme, Layout, Icon} from "@ui-kitten/components";
import Container from "components/Container";
import Content from "components/Content";
import Text from "components/Text";
import Flex from "components/Flex";
import NavigationAction from "components/NavigationAction";
import {useTranslation} from "react-i18next";
import {globalStyle} from "styles/globalStyle";
import * as configService from "services/configService";

// Real FAQ content, admin-editable (product request item) — this screen
// used to show unmodified leftover content from the original CodeCanyon RN
// template this app was built on ("We are team UI/UX and Developer React
// Native & Flutter Hello everybody!", a stranger's WhatsApp number, a
// Messenger chat link) — genuinely shipped to real users. Content now comes
// from configService's cached app config (already fetched at App.tsx
// startup — see saveur-backend's app_config_service.py's "faq" section and
// the admin dashboard's Content page), rendered as a tap-to-expand list
// instead of a wall of static text.
const FaqScreen = () => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(["common", "auth"]);
  const items = configService.getCachedConfig().faq.items;
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <Container>
      <TopNavigation title={t("auth:faq", {defaultValue: "FAQ"})} accessoryLeft={() => <NavigationAction />} />
      <Content contentContainerStyle={styles.content}>
        {items.length === 0 ? (
          <Text category="h9-s" status="placeholder" center mt={20}>
            {t("auth:faq_empty", {defaultValue: "No FAQ items yet."})}
          </Text>
        ) : (
          items.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <Layout key={index} level="2" style={styles.card}>
                <Flex
                  justify="space-between"
                  itemsCenter
                  onPress={() => setOpenIndex(isOpen ? null : index)}>
                  <Text category="h9" bold style={globalStyle.flexOne} mr={12}>
                    {item.question}
                  </Text>
                  <Icon
                    pack="eva"
                    name={isOpen ? "chevron-up-outline" : "chevron-down-outline"}
                    style={[globalStyle.icon20, {tintColor: theme["text-hint-color"]}]}
                  />
                </Flex>
                {isOpen ? (
                  <Text category="h9-s" status="placeholder" mt={10}>
                    {item.answer}
                  </Text>
                ) : null}
              </Layout>
            );
          })
        )}
      </Content>
    </Container>
  );
};

export default FaqScreen;

const themedStyles = StyleService.create({
  content: {
    padding: 20,
  },
  card: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
});
