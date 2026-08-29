import React, {memo} from 'react';
import {TouchableOpacity, StyleSheet} from 'react-native';
import {Icon, useTheme} from '@ui-kitten/components';
import {DrawerActions} from '@react-navigation/native';
import {useNavigation} from '@react-navigation/native';

// SYMPHONY REDESIGN (drawer nav shell) — the app's bottom tab bar is gone,
// replaced by a left drawer (Home/Chat/More — see navigation/MainDrawer.tsx)
// opened from a hamburger button in each of those 3 root screens' own
// headers (src/home/Components/HeaderHome.tsx, src/messages/Chat.tsx,
// src/more/MoreSrc.tsx), matching the reference app's own header layout
// ("☰" top-left on every main screen).
//
// `navigation.dispatch(DrawerActions.openDrawer())` rather than a plain
// `navigation.openDrawer()` call — these 3 screens are all nested several
// navigators deep under the actual Drawer.Navigator (e.g. HomeSrc sits
// inside HomeStackNavigator, which sits inside the Drawer's own "Home"
// screen), so they don't have a drawer-flavored `navigation` object
// directly. `dispatch` with a drawer-specific action bubbles UP the
// navigation tree automatically until it reaches an ancestor navigator that
// can actually handle it (the Drawer), which is the standard React
// Navigation pattern for this exact "deeply nested screen needs to control
// an ancestor navigator" case — no manual `getParent()` chain needed.
//
// Not built on top of `components/NavigationAction.tsx` — that component
// hardcodes `pack="assets"` (this app's own bespoke icon set, PNG-backed),
// and there's no hamburger glyph in that set. `menu-outline` was added to
// the `eva` pack instead (assets/LucideEvaIconsPack.tsx, backed by
// lucide-react-native's vector `Menu` icon — no new binary asset needed),
// so this button renders that directly.
const DrawerMenuButton = memo(() => {
  const navigation = useNavigation();
  const theme = useTheme();
  const onPress = React.useCallback(() => {
    navigation.dispatch(DrawerActions.openDrawer());
  }, [navigation]);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
      style={styles.button}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
  },
});
