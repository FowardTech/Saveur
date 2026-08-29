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
  bg: string;
}

// SYMPHONY REDESIGN follow-up (explicit product request, with reference
// screenshot: "The icons in screenshot 2 should have a background of
// different colors too and the container housing them looks so bad and i
// want them to pop"). Was one flat, identical dark-navy fill (#272e3b) on
// all three of this row's icons (see the render call site's own history
// comment on why that color was picked in the first place) — every icon
// now takes its own `bg` color instead, same vivid solid-fill treatment
// components/OnboardingCluster.tsx's badges use, so the row reads as 3
// distinct actions instead of one monotone block.
const AttachItem = memo(({ title, _onPress, icon, bg }: AttachItemProps) => {
  const styles = useStyleSheet(themedStyles);

  return (
    <TouchableOpacity
      style={styles.container}
      activeOpacity={0.54}
      onPress={_onPress}
    >
      <ImageBackground
        source={Images.fill}
        imageStyle={{ tintColor: bg }}
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
