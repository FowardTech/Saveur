import { StyleService, TopNavigation, useStyleSheet } from "@ui-kitten/components";
import Container from "components/Container";
import Content from "components/Content";
import Text from "components/Text";
import NavigationAction from "components/NavigationAction";
import * as React from "react";
import { useTranslation } from "react-i18next";

const FaqScreen = () => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(["common", "auth"]);
  return (
    <Container>
      <TopNavigation
        title={t("auth:faq")}
        accessoryLeft={() => <NavigationAction />}
      />
      <Content contentContainerStyle={styles.content}>
        <Text category="h3">{t("auth:how_about_team")}</Text>
        <Text>
          {
            "We are team UI/UX and Developer React Native & Flutter Hello everybody!"
          }
        </Text>
        <Text category="h3">{t("auth:how_to_contact_team")}</Text>
        <Text>{"Email: tiepnk971989@gmail.com"}</Text>
        <Text>{"Whatsapp: +84934681313"}</Text>
        <Text category="h3">{t("auth:want_to_discount_next_buy")}</Text>
        <Text>{"Chat: http://m.me/950517708419682"}</Text>
        <Text category="h3">{t("auth:how_about_lisence")}</Text>
        <Text>{"Chat: http://m.me/950517708419682"}</Text>
      </Content>
    </Container>
  );
};

export default FaqScreen;

const themedStyles = StyleService.create({
  content: {
    padding: 24,
    gap: 24,
  },
});
