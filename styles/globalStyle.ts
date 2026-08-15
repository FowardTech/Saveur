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
//
// RESTORED (product follow-up: "now that we changed the app background
// back to white you will have to give the white cards box shadow to show
// that they are cards"). This had been zeroed out on every platform (see
// this comment's own git history for the "remove box shadows from every
// card" request) on the reasoning that Container.tsx's gray page (level=3)
// against each card's white fill (level=2) already gave enough color
// contrast without needing a shadow at all. That reasoning no longer holds
// — Container.tsx's `background-page-body` is back to #FFFFFF (see its own
// comment), the SAME color as a level=2 card, so with cardShadow still
// zeroed cards would be 100% invisible against the page, not just
// under-defined.
//
// iOS/default reuse the exact opacity/radius this app had already tuned by
// eye and shipped right before the later full-removal request (see
// 309f5d2/c60b5b3's own history) — NOT the softer/lower-opacity guess a
// fresh "add some shadow" pass might reach for, since back then a card
// still had gray-page contrast to lean on too; now, with zero color
// contrast left, under-tuning this again would repeat the same
// invisible-card problem this whole restore is fixing.
//
// Android gets `elevation: 3` (Material's own resting-card spec) rather
// than reusing this same object's old `elevation: 4` — see 1f6e1b3's own
// history: `elevation: 12` had read as a heavy dialog-sized halo there,
// not a resting card, and 3 was the fix. Android's box shadow was later
// separately zeroed by an explicit "Android only" removal request before
// the full cross-platform removal landed, so `elevation: 3` (not 4) is
// the actual last-known-good Android value to restore.
const cardShadow = Platform.select({
  ios: {
    shadowColor: 'rgba(31, 41, 84, 0.35)',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10.0,
  },
  android: {
    elevation: 3,
  },
  default: {
    shadowColor: 'rgba(31, 41, 84, 0.35)',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10.0,
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
  // Bumped 20 -> 24 (product request: full wellness-app-inspired reskin,
  // explicit reference screenshots of light, clean fitness/health apps with
  // big, very rounded cards) — reads closer to those references' softer,
  // friendlier card shape than the previous 20px radius.
  // STANDARDIZATION PASS (explicit product request: "make sure that all
  // cards in this app has a border radius of 13 or 14") — 16 -> 14. Since
  // this one object is spread by ~60+ card styles app-wide, this single
  // change is what actually makes "every card" consistent, rather than
  // hunting down each screen's own copy of the number.
  //
  // GOOGLE-STYLE PASS, APP-WIDE (product request: "make sure that this
  // google UI feel goes across the whole app" — asked twice; the first
  // time, scoped to a screen-by-screen local-override pass instead of
  // touching this shared token, per product's own choice at the time (see
  // Home/Practice/Coach's own history for that narrower pass). Repeating
  // it screen-by-screen for the ~60+ files that spread this one object
  // would take many more passes to actually reach "whole app" — this is
  // the single highest-leverage change that gets there immediately: 14 ->
  // 20, the same Material 3/Material You rounder-corner language already
  // used on Home/Practice/Coach's own local overrides (see
  // src/home/QuickActionGrid.tsx's own comment on that design language).
  // Superseded the earlier "13 or 14" standardization decision above with
  // this one, more recent, more specific, more emphatic instruction from
  // the same product owner. Any screen with its OWN explicit local
  // `borderRadius` override (several exist — search for `borderRadius: 14`
  // app-wide) still keeps its own value regardless of this change; those
  // are follow-up candidates for a future pass, not touched here.
  card: {
    borderRadius: 20,
    // Product ask: "remove the box shadow from the white cards and let's
    // see how it looks" — cardShadow (the soft ambient shadow/elevation
    // object above) was removed from this spread. Definition against the
    // white page now comes entirely from the hairline border below (added
    // in the previous "give all the white cards a border" pass), same as
    // this app's earlier flat-bordered ZipRecruiter-style direction before
    // shadows were restored — see cardShadow's own comment for that full
    // back-and-forth history. Easy to re-add `...cardShadow` here if the
    // border-only look reads as too flat once seen live.
    // Product ask: "give all the white cards a border and let's see how
    // they look" — this hairline used to be Android-only (elevation
    // already gave iOS a visible edge, so a border felt redundant there at
    // the time — see this comment's own git history). Since `card` is the
    // one shared object ~60+ card styles app-wide spread, applying the
    // border on every platform here is what actually makes it "all the
    // white cards" in one change rather than a per-screen hunt. Same
    // neutral hairline tone as globalStyle.divider's own border color —
    // easy to revert to the old Platform.select-gated version if the
    // combined border+shadow look reads as too busy once seen live.
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  // Redesign v2 (full reskin): primary buttons get the same soft ambient
  // lift as cards now, tinted toward the brand blue instead of the
  // neutral card shadow (see CtaButton.tsx, the only thing that reads
  // this). Was flattened to `{}` for the earlier flat-bordered direction —
  // re-enabled and re-tuned rather than restoring the old heavier glow.
  // Android's `elevation` dropped per the same "remove Android shadows,
  // leave iOS alone" request as cardShadow above.
  // Briefly retinted to emerald during the wellness-app-inspired reskin
  // pass, then reverted back to brand blue per explicit follow-up ("dont
  // forget to still maintain the default blue color") — same "color stays
  // blue even while everything else about the look changes" precedent as
  // CtaButton.tsx's own color history comment. Shape/shadow softness from
  // the reskin (radius, opacity, blur) all stay; only the tint reverted.
  shadowBtn: Platform.select({
    ios: {
      shadowColor: 'rgba(0, 99, 248, 0.45)',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12.0,
    },
    android: {},
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
  // Product request (follow-up, reversed): "All input fields in the app
  // should have a border radius of 5, background color of gray" gave this
  // `background-basic-color-3` (this app's actual gray fill token). Later
  // product follow-up: "remove the gray background from the input fields
  // but leave the borders on them" -- back to `background-basic-color-2`
  // (this app's white/dark-card surface token, used for every plain card),
  // the same token this field used before the gray request, kept for the
  // same dark-mode-legibility reason documented above (resolves to white
  // in light mode, the correct dark card surface in dark mode, so typed
  // text -- which follows `text-basic-color`, near-white in dark mode --
  // stays legible against it). borderWidth/borderColor/borderRadius all
  // untouched, so the visible border stays exactly as it was.
  inputField: {
    borderWidth: 1,
    borderColor: 'rgba(39, 39, 85, 0.15)',
    backgroundColor: 'background-basic-color-2',
    borderRadius: 5,
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
    width: 9,
    height: 9,
  },
  icon16: {
    width: 18,
    height: 18,
  },
  icon20: {
    width: 28,
    height: 28,
  },
  icon24: {
    width: 27,
    height: 27,
  },
  // Home dashboard's nav tiles + stat cards (product request item — those
  // icons were "too small" at icon20/icon24) — see src/home/HomeSrc.tsx.
  icon28: {
    width: 32,
    height: 32,
  },
  icon40: {
    width: 45,
    height: 45,

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
