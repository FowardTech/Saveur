import React, {memo} from 'react';
import {TouchableOpacity, StyleSheet} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';
import {useAppDrawer} from 'navigation/DrawerContext';

// SYMPHONY REDESIGN (drawer nav shell) — the app's bottom tab bar is gone,
// replaced by a left drawer (Home/Chat/More — see navigation/MainDrawer.tsx)
// opened from a hamburger button in each of those 3 root screens' own
// headers (src/home/Components/HeaderHome.tsx, src/messages/Chat.tsx,
// src/more/MoreSrc.tsx), matching the reference app's own header layout
// ("☰" top-left on every main screen).
//
// `useAppDrawer().open()` rather than react-navigation's
// `navigation.dispatch(DrawerActions.openDrawer())` — this app does NOT use
// @react-navigation/drawer (see navigation/DrawerContext.tsx's own top
// comment for the full story: that package's last v6 release is
// structurally incompatible with this app's installed
// react-native-reanimated@~4.3.2, both of its internal implementations
// being dead ends). The drawer here is a small custom Context
// (navigation/DrawerContext.tsx) paired with a custom sliding overlay
// (components/AppDrawerOverlay.tsx), rendered as a sibling of the screen
// navigator rather than as an ancestor drawer navigator — so there's no
// drawer-flavored navigator anywhere in the tree for a `dispatch` action to
// bubble up to. `useAppDrawer()` reaches that Context directly regardless of
// how deeply nested the calling screen is (HomeSrc sits inside
// HomeStackNavigator, which sits inside MainDrawer's own "Home" tab screen,
// same nesting depth as before), the same way `useNavigation()` did.
//
// Not built on top of `components/NavigationAction.tsx` — that component
// hardcodes `pack="assets"` (this app's own bespoke icon set, PNG-backed),
// and there's no hamburger glyph in that set. `menu-outline` was added to
// the `eva` pack instead (assets/LucideEvaIconsPack.tsx, backed by
// lucide-react-native's vector `Menu` icon — no new binary asset needed),
// so this button renders that directly.
// SYMPHONY REDESIGN follow-up (explicit product request: "move the menu
// thumbnail icon up to be on the same level with the greetings and its
// supposed to have white background"). Was a bare transparent icon, no
// fill — now a real white/dark-elevated circular button (background-
// basic-color-2, same "always white" card-surface token used everywhere
// else this pass), matching the reference app's own filled hamburger
// button.
//
// A same-direction "-2 optical nudge" was tried here first (moving the
// whole button up slightly), but the follow-up report ("the text is not
// leveling with the menu thumbnail... the text will be moving up above
// the level of the menu thumbnail") makes clear the greeting TEXT is what
// sits too low, not this button — nudging the button up as well would
// only have widened that gap. Reverted back to a plain, unshifted button;
// the real fix is on the text side (see HeaderHome.tsx's own comment).
const DrawerMenuButton = memo(() => {
  const {open} = useAppDrawer();
  const theme = useTheme();
  return (
    <TouchableOpacity
      onPress={open}
      activeOpacity={0.7}
      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
      style={[styles.button, {backgroundColor: theme['background-basic-color-2']}]}>
      <Icon
        pack="eva"
        name="menu-outline"
        style={[styles.icon, {tintColor: theme['text-basic-color']}]}
      />
    </TouchableOpacity>
  );
});

export default DrawerMenuButton;

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 22,
    height: 22,
  },
});
