import React from 'react';

// SYMPHONY REDESIGN (drawer nav shell) — deliberately NOT built on
// @react-navigation/drawer. That package's own "modern" implementation
// imports `useAnimatedGestureHandler` from react-native-reanimated
// (node_modules/@react-navigation/drawer/lib/module/views/modern/Drawer.js),
// a hook Reanimated 3 deprecated and Reanimated 4 (this app's installed
// version, ~4.3.2) removed entirely — confirmed by grepping the entire
// installed react-native-reanimated package for that name and finding zero
// matches. Its OTHER ("legacy") implementation explicitly throws by design
// on any Reanimated 3+ install (real crash report: "The
// `useLegacyImplementation` prop is not available with Reanimated 3...").
// Both code paths in that library are dead ends for this app's Reanimated
// version, and the package itself is the last-ever release for React
// Navigation v6 (npm flags it "no longer supported") — not something to
// wait out a patch for.
//
// This is a small, self-built replacement: a plain React Context holding
// open/close/toggle, paired with components/AppDrawerOverlay.tsx (the
// actual sliding panel + backdrop, animated with Reanimated's CURRENT,
// still-supported APIs — useSharedValue/useAnimatedStyle/withTiming, no
// gesture-handler hook involved at all). navigation/MainDrawer.tsx renders
// the real screen navigator (a plain createBottomTabNavigator, the exact
// same proven, already-working navigator type the old bottom tab bar used
// — its own visual tab bar is just hidden) and wraps it in this Provider;
// components/DrawerMenuButton.tsx calls `useAppDrawer().open()` instead of
// react-navigation's `DrawerActions.openDrawer()`.
interface DrawerContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

export const DrawerProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const value = React.useMemo<DrawerContextValue>(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen(v => !v),
    }),
    [isOpen],
  );
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};

export function useAppDrawer(): DrawerContextValue {
  const ctx = React.useContext(DrawerContext);
  if (!ctx) {
    // Every one of this drawer's 3 root screens (Home/Chat/More) renders
    // under navigation/MainDrawer.tsx's <DrawerProvider>, so this should
    // never actually fire — a hard error surfaces a wiring mistake
    // immediately instead of DrawerMenuButton silently doing nothing.
    throw new Error('useAppDrawer() must be called within <DrawerProvider>.');
  }
  return ctx;
}
