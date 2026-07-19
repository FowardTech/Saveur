import * as React from "react";

import Container from "components/Container";
import Text from "components/Text";
import {
  StyleService,
  TopNavigation,
  useStyleSheet,
} from "@ui-kitten/components";
import NavigationAction from "components/NavigationAction";
import { useTranslation } from "react-i18next";
import Content from "components/Content";

const AboutScreen = () => {
  const { t } = useTranslation(["common", "auth"]);
  const styles = useStyleSheet(themedStyles);
  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t("auth:about")}
      />
      <Content contentContainerStyle={styles.content}>
        <Text category="h3">{t("auth:my_team")}</Text>
        <Text>
          {
            "We are team UI/UX and Developer React Native & Flutter Hello everybody!"
          }
        </Text>
        <Text category="h3">{t("auth:contact_us")}</Text>
        <Text>Chat: http://m.me/950517708419682</Text>
        <Text category="h3">{t("auth:my_portfolio")}</Text>
        <Text>
          Please bookmark this link to see more items and new updates: 
          https://codecanyon.net/user/thirteendev
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
    gap: 24,
    padding: 24,
  },
});
