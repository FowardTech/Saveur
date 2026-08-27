import React, { memo } from "react";
import { TouchableOpacity, ImageBackground } from "react-native";
import Text from "components/Text";
import { Images } from "assets/images";
import {
  Icon,
  StyleService,
  useStyleSheet,
} from "@ui-kitten/components";
import { globalStyle } from "styles/globalStyle";

interface AttachItemProps {
  title: string;
  _onPress?(): void;
  icon: string;
}

const AttachItem = memo(({ title, _onPress, icon }: AttachItemProps) => {
  const styles = useStyleSheet(themedStyles);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.54}
      onPress={_onPress}
    >
      {/* Product report: "the attach icon, start a video practice icon and
          the view my progress icon should all be in this background
          color: #272e3b" -- was three different pastel per-icon tints
          (facebook/twitter/success brand colors, repurposed here). One
          flat literal fill for all three now, per icon prop. */}
      <ImageBackground
        source={Images.fill}
        imageStyle={{ tintColor: '#272e3b' }}
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
