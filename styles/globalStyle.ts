import {Platform, StyleSheet} from 'react-native';

// Redesign v2 (full reskin, product request item — explicit reference:
// "screenshot 3", described as soft shadows / big rounded cards / colorful
// pill nav, replacing the earlier flat-bordered ZipRecruiter direction
// above). `card` goes back to a real soft shadow instead of a hairline
// border — tuned lighter/softer than the pre-ZipRecruiter `cardShadow` this
// replaces (lower opacity, bigger radius, no directional offset) so it reads
// as an ambient lift rather than a hard drop shadow.
//
// Still theme-agnostic (matches globalStyle.divider's existing
// `rgba(128,128,128,0.15)` convention) rather than a theme token, since
// `card` is a plain StyleSheet.create value spread by ~60+ files at module
// scope with no theme/hook access.
//
// NOTE on Android: `elevation` needs an opaque backgroundColor on the same
// View to compute a correctly-rounded shadow — any card whose fill is
// translucent (or applied via a separate underlay) still needs the
// two-layer split called out in the older comment history here (HomeSrc.tsx
// checkInCard, LearningCourses.tsx rejectedBox/curriculumDoneBox,
// ReferralProgram.tsx creditCard, CareerRoadmap.tsx completeBanner,
// CourseSession.tsx certCard) — that workaround is back in play now that
// `card` uses elevation again.
const cardShadow = Platform.select({
  ios: {
    shadowColor: 'rgba(31, 41, 84, 0.35)',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.10,
    shadowRadius: 16.0,
  },
  android: {
    elevation: 4,
  },
  default: {
    shadowColor: 'rgba(31, 41, 84, 0.35)',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.10,
    shadowRadius: 16.0,
    elevation: 4,
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
  // Redesign v2 (full reskin — soft ambient shadow is back everywhere, see
  // cardShadow's comment above): ButtonFill's round icon circles
  // (MoreSrc.tsx's row icons, etc.) get the same soft lift as everything
  // else now. Shape still comes from a squircle PNG (Images.fillActive),
  // not real borderRadius clipping, but a shadow (unlike a border) doesn't
  // need to follow the image's curve exactly to look right.
  shadow: cardShadow,
  shadowFade: cardShadow,
  // The canonical "content card": 20px radius (bumped up from 16px to read
  // as the bigger, softer rounded-card look the reskin reference uses) +
  // the soft ambient shadow above, in one style instead of every screen
  // re-picking its own radius/shadow. Doesn't set backgroundColor/padding
  // since those vary (Layout level="1"/"2" usually supplies the
  // background) — just the shape + lift.
  card: {
    borderRadius: 20,
    ...cardShadow,
  },
  // Redesign v2 (full reskin): primary buttons get the same soft ambient
  // lift as cards now, tinted toward the brand blue instead of the
  // neutral card shadow (see CtaButton.tsx, the only thing that reads
  // this). Was flattened to `{}` for the earlier flat-bordered direction —
  // re-enabled and re-tuned rather than restoring the old heavier glow.
  shadowBtn: Platform.select({
    ios: {
      shadowColor: 'rgba(0, 99, 248, 0.45)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12.0,
    },
    android: { elevation: 6 },
    default: {
      shadowColor: 'rgba(0, 99, 248, 0.45)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12.0,
      elevation: 6,
    },
  }) as object,
  // Same soft ambient shadow as `card`, for filter/chip pills that sit on
  // top of other content (e.g. floating filter bars) and need to visually
  // separate from what's behind them.
  shadowFilter: cardShadow,

  // Bug report: "users can't tell there's an input field there" — the
  // app's default <Input> theme mapping (constants/theme/mapping.json,
  // "Input" > appearances.default > status="basic") sets
  // backgroundColor:'transparent' AND borderWidth:0 for the default
  // "medium" size, so a plain `<Input status="basic" />` with no extra
  // style renders with zero visible affordance — no border, no fill,
  // indistinguishable from empty space. Fixing that mapping directly isn't
  // an option: login/signup screens deliberately rely on the exact same
  // default/basic mapping and add their OWN explicit
  // `borderBottomWidth: 2` override per field (see src/auth/Login/
  // Login.tsx's `email`/`password` styles) — a global mapping change would
  // touch those too, and the explicit ask was "not talking about signup or
  // login." This is instead an opt-in style every OTHER screen's <Input>
  // spreads locally: a real border + a white fill, so a field reads as an
  // input the same way a white card reads as a card against this app's
  // gray page background.
  // BUG FIX (product report: "input fields don't have padding so text/icons
  // are touching the edges, and text isn't visible in dark mode when
  // typing"):
  // Dark mode text — `backgroundColor` was a hardcoded '#FFFFFF' literal in
  // a plain (non-theme-aware) StyleSheet, so it never adapted to dark mode.
  // The text typed inside an <Input> DOES follow the theme's
  // `text-basic-color`, which is near-white (#F5F5FA — see constants/theme/
  // dark.json) in dark mode for legibility against dark surfaces — paired
  // with this permanently-white field, that's white text on a white field,
  // invisible while typing. Switched to the `background-basic-color-2`
  // token instead: it resolves to the exact same white this hardcoded value
  // gave in light mode ($color-basic-100 in light.json), but the correct
  // dark card surface (#1B1B2E) in dark mode, the same token every other
  // card/surface in this app already uses — so the paired light text
  // becomes legible again, consistent with how every other surface already
  // handles theme switching. Works even though this file is plain RN
  // StyleSheet with no theme hook: every call site spreads `...globalStyle.
  // inputField` into its own `StyleService.create({...})`, which resolves
  // theme-token strings in the final merged style regardless of which layer
  // contributed the key.
  inputField: {
    borderWidth: 1,
    borderColor: 'rgba(39, 39, 85, 0.15)',
    backgroundColor: 'background-basic-color-2',
    borderRadius: 12,
  },
  // Follow-up correction: paddingHorizontal/paddingVertical used to live on
  // `inputField` above, applied to the Input's OUTER container/border box —
  // explicit feedback was that this shrank the field's own visible
  // width/box instead of just spacing the text inside it (padding on that
  // outer container eats into the box from the border inward, on top of the
  // icon's own existing `iconMarginHorizontal` gap, which reads as a
  // narrower field rather than the same-size field with roomier text).
  // Moved here instead — pass this as the <Input>'s `textStyle` prop
  // (applies directly to the inner TextInput, not the bordered container),
  // so the field itself stays exactly full width/size, and only the
  // text/placeholder inside it gets breathing room from the edges.
  inputText: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  // Home dashboard's nav tiles + stat cards (product request item — those
  // icons were "too small" at icon20/icon24) — see src/home/HomeSrc.tsx.
  icon28: {
    width: 28,
    height: 28,
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
    // borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
});
