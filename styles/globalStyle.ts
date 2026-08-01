import {Platform, StyleSheet} from 'react-native';

// Shared shadow preset used by `shadowFade` (kept for existing call sites
// that still explicitly want a soft lift, e.g. modals/sheets) — NOT used by
// `card` below anymore. See cardBorder's own comment for why.
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

// Redesign (product request item — explicit ZipRecruiter reference: "all
// the cards have no box shadows they have border lines... Very clean,
// precise and professional"): `card`'s shadow is replaced with a thin
// 1px border, matching the reference screenshots exactly instead of
// approximating them with a softened shadow.
//
// This is also the permanent, correct fix for the WHOLE CLASS of Android
// "extra white/ghost card behind" bugs fixed earlier this session
// (HomeSrc.tsx's checkInCard, LearningCourses.tsx's rejectedBox/
// curriculumDoneBox, ReferralProgram.tsx's creditCard, CareerRoadmap.tsx's
// completeBanner, CourseSession.tsx's certCard) — those all had to be
// split into two nested Views specifically to work around `elevation`
// needing an opaque background to compute a correctly-rounded shadow on
// Android. A border has no such requirement — it renders identically
// regardless of the fill underneath, translucent or not, on both
// platforms. Any NEW translucent-tinted card added going forward doesn't
// need that two-layer workaround anymore.
//
// Theme-agnostic translucent color (matches globalStyle.divider's existing
// `rgba(128,128,128,0.15)` convention below) rather than a theme token,
// since `card` is a plain StyleSheet.create value spread by ~60+ files at
// module scope with no theme/hook access — reads as a light hairline on
// light backgrounds and a slightly-lighter one on dark backgrounds without
// needing separate light/dark values (constants/theme/*.json's new
// `border-card-default` token is the theme-aware equivalent, used by
// screens that already have `theme` in scope and want an exact token
// match, e.g. new StatusBadge/InfoBox components).
const cardBorder = {
  borderWidth: 1,
  borderColor: 'rgba(39, 39, 85, 0.12)',
} as object;

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
  // Redesign (product request item, ZipRecruiter reference): was a heavy
  // drop shadow (elevation:10 on Android) behind ButtonFill's round icon
  // circles (MoreSrc.tsx's row icons, etc.) — flattened to nothing for the
  // same "no box shadows" reason as `shadowBtn`/`shadowFilter` above.
  // NOT given a border like `card`/`shadow`-on-cards got: ButtonFill's
  // shape comes from a squircle PNG (Images.fillActive), not real
  // borderRadius clipping on this container — see that component's own
  // borderColor-prop comment for why a plain rectangular
  // borderWidth/borderColor here would draw a square outline poking out
  // past the image's rounded corners instead of following its curve.
  shadow: {},
  shadowFade: cardShadow,
  // The canonical "content card": 16px radius (the size already used most
  // often across the app) + a thin border (see cardBorder above for why
  // this moved off shadow/elevation entirely), in one style instead of
  // every screen re-picking its own radius and deciding whether to bother
  // with a border at all. Doesn't set backgroundColor/padding since those
  // vary (Layout level="1"/"2" usually supplies the background) — just the
  // shape + outline.
  card: {
    borderRadius: 16,
    ...cardBorder,
  },
  // Redesign (product request item, ZipRecruiter reference — buttons in
  // the reference are completely flat, no glow/lift of any kind): was a
  // shadowColor/shadowOpacity/shadowRadius/elevation glow around every
  // primary button (already toned down once from an even bigger one, per
  // the comment history this replaced). Flattened to nothing rather than
  // re-tuning the glow smaller a second time, since the actual target now
  // is "no shadow", not "a smaller shadow". Kept as a real (empty) style
  // object rather than deleting it outright so every existing
  // `style={[globalStyle.shadowBtn, ...]}` call site across the app keeps
  // working unchanged — it now just contributes nothing.
  shadowBtn: {},
  // Same flattening as shadowBtn above, same reasoning.
  shadowFilter: {},

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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.15)',
  },
});
