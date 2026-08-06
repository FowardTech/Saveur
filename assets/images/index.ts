export const Images = {
  logo: require('./logo.png'),
  // Default artwork for the admin-configurable Home-screen banner (see
  // src/home/HomeSrc.tsx and services/adsService.ts's getHomeBanner()) —
  // used whenever the admin hasn't set an image_url on the active
  // placement="home_banner" Advertisement row, so the banner still looks
  // right the moment one is created with just title/body/detail_body
  // filled in. Product-supplied "AI Career Coach" promo graphic.
  homeBannerAiCoach: require('./img_home_banner_ai_coach.jpg'),
  // Real Saveur mark (see assets/images/applogo.png, the source the user
  // supplied — a blue "S" on a very light gray, #F4F4F4) — square with that
  // same light-gray background baked in, so it drops cleanly onto pretty
  // much any surface as a self-contained badge (avatar circles, the
  // success screen) without needing a colored backdrop of its own.
  // logoMark is the same artwork with the background chroma-keyed to
  // transparent, for placing the mark directly on a matching light-gray
  // surface (see the native splash screens/app icons, which use the same
  // extracted mark — regenerated from applogo.png outside this bundle).
  logoBadge: require('./logo_square.png'),
  logoMark: require('./logo_mark.png'),
  art1: require('./img_art_1.png'),
  art2: require('./img_art_2.png'),
  art3: require('./img_art_3.png'),
  success: require('./img_success.png'),
  successBg: require('./img_success_bg.png'),
  modalBg: require('./img_modalBg.png'),
  handle: require('./img_handle.png'),
  fillActive: require('./img_fillActive.png'),
  fill: require('./img_fill.png'),
  // Was img_logo.png — a leftover template placeholder (a gradient circle
  // with a bite taken out of it) that rendered as an odd, unbranded "C."
  // mark on the post-signup welcome screen. Now the real logo.
  logoSuccess: require('./logo_square.png'),
  emptyFavorites: require('./img_empty_favorites.png'),
  videoFrame: require('./img_videoFrame.png'),
  avatar: require('./img_avatar.png'),
  avatar1: require('./img_avatar_1.png'),
  avatar2: require('./img_avatar_2.png'),
  avatar3: require('./img_avatar_3.png'),
  avatar4: require('./img_avatar_4.png'),
  avatar5: require('./img_avatar_5.png'),
  avatar6: require('./img_avatar_6.png'),
  avatar7: require('./img_avatar_7.png'),
  avatar8: require('./img_avatar_8.png'),
  avatar9: require('./img_avatar_9.png'),
  avatar10: require('./img_avatar_10.png'),
  dayActive: require('./img_day_active.png'),
  dayInactive: require('./img_day_inactive.png'),
  pinLocation: require('./img_pin_location.png'),
  cover: require('./img_cover.png'),
  cover1: require('./img_cover_1.png'),
  cover2: require('./img_cover_2.png'),
  map: require('./img_map.png'),
  emptyMess: require('./img_empty_mess.png'),
  videoCall: require('./img_video_call.png'),
  cameraCall: require('./img_camera_call.png'),
  noApplication: require('./img_no_application.png'),
  noBooking: require('./img_no_booking.png'),
  noInterview: require('./img_no_interview.png'),
  bgSuggestion: require('./img_bg_suggestion.png'),
  // Product-supplied replacement (explicit request: "replace the pink
  // circle design... with image 4") for the AI-coach "listening/thinking/
  // speaking" orb — was a purple/pink LinearGradient sphere (VoiceCoachView.
  // tsx and src/practice/LiveInterviewSession.tsx both rendered the exact
  // same ['#6E8CFF', '#9B7BFF', '#C58BFF'] gradient), swapped for this real
  // photographed/rendered glassy blue sphere image instead — genuinely
  // transparent PNG (only the sphere itself is opaque, verified via its
  // alpha channel), @1x/@2x/@3x provided at 240/480/720px so it stays
  // crisp at this app's largest current orb size (200px, LiveInterviewSession.
  // tsx's ORB_SIZE) with headroom.
  //
  // SECOND replacement (product request: "replace the blue round ball...
  // with the GIF image" — a rotating/animated version of the same glassy
  // blue sphere concept). The user's original upload was an 800x800, 181-
  // frame, 23MB GIF — far too large to bundle as a repeatedly-rendered UI
  // element (app size + decode memory), so this is a re-encoded version
  // (ffmpeg, palette-optimized, 360x360 @ 15fps @ 160 colors) at ~2.7MB —
  // big enough to stay crisp at this orb's largest on-screen size (up to
  // 200pt, i.e. 600px at @3x) without shipping 3 separate per-density GIF
  // files (which would have roughly tripled total size for a soft gradient
  // image that doesn't need pixel-perfect density matching to look good).
  // See android/app/build.gradle's animated-gif Fresco dependency comment —
  // Android's <Image> needs that native module to actually animate a GIF
  // instead of freezing on its first frame; iOS animates GIFs via <Image>
  // with no extra config needed.
  voiceOrb: require('./orb_gradient.gif'),
  // Product-supplied replacement for the homescreen XP check-in card's
  // gamification badge (was the eva "award" icon, tinted gold) — a real
  // 3D-rendered gold medal/ribbon graphic. Genuinely transparent PNG
  // (verified via its alpha channel — corner pixel is (255,255,255,0),
  // fully transparent, not an opaque white/black square), tightly cropped
  // to the medal's own bounding box plus a small margin. @1x/@2x/@3x at
  // 36x46/72x92/108x138 — the medal's own aspect ratio (~36:46, taller
  // than wide because of the ribbon tails) rather than a square, unlike
  // most of this app's other small icon assets.
  xpMedal: require('./img_xp_medal.png'),
  creditCard: require('./img_credit_card.png'),
  shape: require('./img_shape.png'),
  createPost: require('./img_create_post.png'),
  noCard: require('./img_no_card.png'),
  loading: require('./loading.json'),
  childCare: require("./img_child_care.png"),
  petCare: require("./img_pet_care.png"),
  housekeeping: require("./img_housekeeping.png"),
  specialNeeds: require("./img_special_needs.png"),
  tutoring: require("./img_tutoring.png"),
  seniorCare: require("./img_senior_care.png"),
};
