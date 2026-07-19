import React, { memo } from "react";
import { TouchableOpacity, ImageBackground } from "react-native";
import Text from "components/Text";
import { Images } from "assets/images";
import {
  Icon,
  StyleService,
  useStyleSheet,
  useTheme,
} from "@ui-kitten/components";
import { globalStyle } from "styles/globalStyle";

interface AttachItemProps {
  title: string;
  _onPress?(): void;
  icon: string;
}

const AttachItem = memo(({ title, _onPress, icon }: AttachItemProps) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.54}
      onPress={_onPress}
    >
      <ImageBackground
        source={Images.fill}
        imageStyle={{
          tintColor:
            icon === "attach"
              ? theme["color-facebook-100"]
              : icon === "call"
              ? theme["color-twitter-100"]
              : theme["color-success-100"],
        }}
        style={styles.logo}
      >
        <Icon pack="assets" name={icon} style={styles.icon} />
      </ImageBackground>
      <Text category="h9-s" center maxWidth={60} mt={12}>
        {title}
      </Text>
    </TouchableOpacity>
  );
});

export default AttachItem;

const themedStyles = StyleService.create({
  container: {
    ...globalStyle.center,
  },
  logo: {
    width: 40,
    height: 40,
    ...globalStyle.center,
  },
  icon: {
    ...globalStyle.icon24,
    tintColor: "#FFF",
  },
});
