import React from "react";
import { ScrollView, ScrollViewProps } from "react-native";
import { useTheme } from "@ui-kitten/components";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

interface ContentProps extends ScrollViewProps {
  padder?: boolean;
  level?: "1" | "2" | "3" | "4" | "5";
  // Plain ScrollView (the default below) does nothing when the keyboard
  // opens — on screens with text inputs near the bottom, the keyboard just
  // covers them. Opt in per-screen with avoidKeyboard rather than switching
  // every Content usage app-wide (Content is used on ~40+ screens, most of
  // which have no text input at all and don't need this). Uses
  // react-native-keyboard-aware-scroll-view — already a dependency and
  // already used successfully the same way in src/auth/Login/Login.tsx —
  // rather than introducing a second keyboard-handling library.
  avoidKeyboard?: boolean;
}

const Content: React.FC<ContentProps> = ({
  style,
  contentContainerStyle,
  children,
  padder,
  level,
  avoidKeyboard,
  ...props
}) => {
  const theme = useTheme();
  const ScrollComponent = avoidKeyboard ? KeyboardAwareScrollView : ScrollView;
  return (
    <ScrollComponent
      {...props}
      style={[
        { backgroundColor: theme[`background-basic-color-${level}`] },
        style,
      ]}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        contentContainerStyle,
        padder && { paddingHorizontal: 24 },
      ]}
      {...(avoidKeyboard ? { enableOnAndroid: true, extraScrollHeight: 20 } : {})}
    >
      {children}
    </ScrollComponent>
  );
};

export default Content;
