import React from "react";
import { TouchableOpacity, ViewStyle, StyleProp } from "react-native";
import { useStyleSheet, StyleService, Icon } from "@ui-kitten/components";
import { globalStyle } from "styles/globalStyle";

interface ComposerProps {
  style?: StyleProp<ViewStyle>;
  onShowAction(): void;
}

// SYMPHONY REDESIGN follow-up (product report, with reference screenshots:
// "let it be like a card with box shadow containing the text field, the
// plus sign which when its clicked it pops up all the items"). Was a
// 3-icon row (+, camera, photo library) that collapsed/expanded on
// keyboard show, absolutely positioned to the left of the input pill via
// a marginLeft-reservation hack on Chat.tsx's own primaryStyle — that
// whole setup is what the product report meant by the input row looking
// "clumsy." Camera/photo library are now entries INSIDE the attach sheet
// this "+" opens (see Chat.tsx's showAction Layout), matching Symphony's
// own reference screenshot, so this is just the single, permanent "+"
// trigger now — rendered through InputToolbar's real `renderActions` slot
// (see Chat.tsx's renderInputToolbar) instead of the old absolute-
// position/marginLeft trick, so it can sit as a normal sibling of the
// text input inside one unified card instead of floating above it.
const Composer = ({ style, onShowAction }: ComposerProps) => {
  const styles = useStyleSheet(themedStyles);
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onShowAction}
      style={[styles.container, style]}
    >
      <Icon pack="assets" name="addMore" style={styles.icon} />
    </TouchableOpacity>
  );
};

export default Composer;

const themedStyles = StyleService.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  // Product report: "the plus icon, camera icon, image icon all should be
  // light gray color. At least very visible light gray color" — color-
  // basic-600 (#9393AA) is this app's own "visible mid-gray" token.
  icon: {
    tintColor: "color-basic-600",
    ...globalStyle.icon24,
  },
});
