import {Platform, StyleSheet} from 'react-native';

// Shared shadow preset used by both `shadowFade` (kept for existing call
// sites) and the new `card` composite below — a design-consistency pass
// found 60+ files hand-rolling their own card borderRadius (12/14/16/18/20/
// 24/28 all used interchangeably for what's visually "the same kind of
// card") with no shadow at all, sitting flat next to shadowed cards
// elsewhere on the same screen. `card` is the new default: reach for it on
// any new content card instead of a one-off borderRadius/shadow pair.
//
// elevation: 12 (Android) was the actual bug behind "the box shadow looks
// so bad on Android" once `card` got applied to ~45 cards app-wide: Android's
// `elevation` has no shadowColor/shadowOpacity equivalent to soften it —
// it's always a flat, dark, fixed-appearance halo, and its SIZE scales
// directly with the elevation number. 12dp is Material Design's own spec
// for a raised dialog/modal, not a resting content card (Material's card
// spec is ~1dp resting / up to ~8dp only when actively being dragged) — so
// every single card on Android was rendering with a dialog-sized dark halo
// around it. iOS's shadowOpacity/shadowRadius/shadowColor trio doesn't have
// this problem (it's a real, tintable, soft-edged shadow), which is exactly
// why this only ever looked bad on Android and nobody noticed until it was
// applied everywhere. Platform.select splits the two instead of one shared
// number that was only ever tuned by eye on iOS.
const cardShadow = Platform.select({
  ios: {
    shadowColor: 'rgba(29, 30, 44, 0.28)',
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.38,
    shadowRadius: 12.0,
  },
  android: {
    elevation: 3,
  },
  default: {
    shadowColor: 'rgba(29, 30, 44, 0.28)',
    shadowOffset: {
      width: 1,
      height: 1,
    },
    shadowOpacity: 0.38,
    shadowRadius: 12.0,
    elevation: 3,
  },
}) as object;

export const globalStyle = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  justifyCenter: {
    justifyContent: 'center',
  },
  itemsCenter: {
    alignItems: 'center',
  },
  absoluteBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -10,
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: -10,
  },
  fitBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropStyle: {
    backgroundColor: 'rgba(30, 31, 32, 0.86)',
  },
  //Shadow
  shadow: {
    shadowColor: 'rgba(29, 30, 44, 0.61)',
    shadowOffset: {
      width: 1,
      height: 12,
    },

    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  shadowFade: cardShadow,
  // The canonical "content card": 16px radius (the size already used most
  // often across the app) + the shadowFade lift, in one style instead of
  // every screen re-picking its own radius and deciding whether to bother
  // with a shadow at all. Doesn't set backgroundColor/padding since those
  // vary (Layout level="1"/"2" usually supplies the background) — just the
  // shape + lift.
  card: {
    borderRadius: 16,
    ...cardShadow,
  },
  // Was shadowOpacity 0.58 / shadowRadius 12 / elevation 24 — a genuinely
  // huge blue glow around every primary button, especially visible on
  // Android where `elevation` alone (no opacity control) rendered it as a
  // heavy dark halo. Toned down to a subtle lift instead of a floating-glow
  // effect.
  shadowBtn: {
    shadowColor: '#2574FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6.0,

    elevation: 4,
  },
  shadowFilter: {
    shadowColor: '#FE9870',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.58,
    shadowRadius: 12.0,

    elevation: 24,
  },

  //Border
  border12: {
    borderRadius: 12,
  },
  border16: {
    borderRadius: 16,
  },
  topBorder16: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bottomBorder16: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  topBorder24: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomBorder24: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  topBorder28: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  bottomBorder28: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  //margin , padding
  padH24: {
    paddingHorizontal: 24,
  },
  padH16: {
    paddingHorizontal: 16,
  },
  marH24: {
    marginHorizontal: 24,
  },
  padH32: {
    paddingHorizontal: 32,
  },
  marH32: {
    marginHorizontal: 32,
  },
  padV24: {
    paddingVertical: 24,
  },
  marV24: {
    marginVertical: 24,
  },
  padV32: {
    paddingVertical: 32,
  },
  marV32: {
    marginVertical: 32,
  },

  //flex
  flexSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flexDirection: {
    flexDirection: 'row',
  },
  alignSelfEnd: {
    alignSelf: 'flex-end',
  },
  alignItemsCenter: {
    alignItems: 'center',
  },
  alignSelfCenter: {
    alignSelf: 'center',
  },
  //icon
  dot: {
    width: 3,
    height: 3,
    marginHorizontal: 8,
    borderRadius: 99,
  },
  icon8: {
    width: 8,
    height: 8,
  },
  icon16: {
    width: 16,
    height: 16,
  },
  icon20: {
    width: 20,
    height: 20,
  },
  icon24: {
    width: 24,
    height: 24,
  },
  icon40: {
    width: 40,
    height: 40,
  },
  // The exact same `rgba(128,128,128,0.15)` bottom-border was independently
  // hand-rolled in several unrelated screens (InterviewReplay, Student
  // Verification, transcript/list rows) as a one-off row divider — pulled
  // out here so it's one shared value instead of N copies that could each
  // drift differently.
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
});
