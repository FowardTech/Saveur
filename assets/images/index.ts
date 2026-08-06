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
  // Onboarding carousel illustrations (product request: "In the onboarding
  // screen I want us to use the perfect illustrations from there... Just
  // get free ones online that looks very good and modern" — icons8/
  // iconscout/streamline suggested as reference sites). Replaces the
  // earlier real-photo approach (5 hotlinked Pexels URLs in
  // src/onboarding/index.tsx) with proper flat-style illustrations
  // instead, one per slide topic, matching what the referenced sites
  // actually sell as "illustration packs."
  //
  // THIRD PASS — original artwork, not sourced online. The first two passes
  // both used unDraw (free/no-attribution, undraw.co/license) and were
  // rejected as not matching a reference screenshot the product owner
  // shared: a phone-mockup hero with floating drop-shadowed cards, a warm
  // gradient backdrop, flat-but-colorful characters. Before designing from
  // scratch, DrawKit, ManyPixels, Humaaans, Open Doodles, Storyset,
  // Craftwork, and Iconscout were all evaluated as alternative *sources*
  // for that exact look and ruled out (see git log on this file for the
  // full per-source trail) — so these 5 are hand-built SVG artwork
  // instead, generated by a small reusable Python "design kit"
  // (svg_kit.py/components.py/palette.py/person2.py, this session's
  // scratch workspace, not checked into the repo) and rasterized with
  // cairosvg at 1200x1050.
  //
  // FOURTH PASS (two follow-up reports on the third pass) — same design
  // kit, two real changes to it:
  // 1) "I need a human like illustration... not a cartoon" — replaced the
  // original character (a circle head on a dome-shaped torso, no neck or
  // limbs — an avatar icon, not a person) with a properly-proportioned
  // seated figure: real neck, hourglass torso, two-segment arms ending in
  // visible hands, crossed legs. person2.py's `person_full()`/`arm()`.
  // 2) "the backgrounds have to be transparent" — the canvas used to have
  // an opaque corner-to-corner gradient fill (read as a "square" behind
  // the artwork); `components.py`'s `background()` now only paints two
  // soft blurred color blobs with real per-pixel alpha, nothing opaque, so
  // it blends into whatever page background sits behind it in the app.
  //
  // A third report in the same round ("placing them at the left of the
  // screen where they are touching the edge") turned out to be an
  // unrelated pre-existing layout bug in src/onboarding/index.tsx (the
  // image box was missing `alignSelf: 'center'`), not an artwork problem —
  // fixed there, see that file's own comment.
  //
  // FIFTH PASS — same reference screenshot, re-shared with a closer look
  // requested: "I need a human like illustration... the illustration you
  // are giving me looks like cartoons", "stop wrapping the illustrations
  // in a box", "use gradient designs like that". Three real changes to
  // the design kit:
  // 1) Proportions were still too "big head on a small body" (cartoon-
  // mascot territory) — person2.py's person_full() now uses a taller
  // torso and wider shoulders relative to head size.
  // 2) Hands were plain circles — added hand_detail() (a palm + 4 fanned
  // fingers + thumb, oriented to the arm's approach angle) and
  // praying_hands() (a proper clasped/namaste gesture for the meditating
  // "learning" character, replacing generic held-object hands), since
  // finger detail is one of the biggest cartoon-vs-illustrated-human
  // tells.
  // 3) Every major fill (clothing, pants, cards) switched from a flat hex
  // color to a soft diagonal light-to-dark gradient (components.py's new
  // shade_gradient()/card_gradient(), built on top of the existing
  // linear_gradient() helper) — matching the reference's shaded, not flat,
  // illustration style.
  // Also removed styles.image's borderRadius/overflow:hidden in
  // src/onboarding/index.tsx (see that file) since even with no
  // backgroundColor, a rounded clipping boundary was still reading as a
  // "box" around the artwork.
  //
  // SIXTH PASS (current) — the product owner sourced and uploaded 5
  // finished illustrations directly ("Now i got the perfect ones"),
  // superseding the FOURTH/FIFTH-pass design-kit artwork described above.
  // A first attempt processed the uploaded SVGs through a local renderer,
  // which lost fidelity (missing font caused headline overflow, and
  // flattened each file's transparent background); the product owner then
  // supplied the original full-resolution PNG exports directly ("Sorry
  // this are the real illustrations use these ones") and this is what
  // ships. Each source PNG was a full hero composition — headline (and on
  // some slides a subtitle) baked into the image as pixels, above the same
  // phone-mockup + floating-card illustration. That baked headline/
  // subtitle was cropped out before use — it can't be localized via this
  // app's `i18n`/SUPPORTED_LANGUAGES picker, and it duplicates this
  // screen's own translatable title/subtitle text. Text baked *inside*
  // the phone-mockup screen itself (e.g. "Hi, Alex!", "Overall Match") was
  // kept, since that's illustrated fake-app-UI content rather than a
  // competing copy of this screen's own copy. Each source file's real
  // transparent background (alpha channel, not a flattened rectangle) was
  // preserved. What ships is the illustration only — phone mockup,
  // floating drop-shadowed cards, decorative sparkles, soft gradient
  // backdrop — with src/onboarding/index.tsx's own translatable
  // title/subtitle <Text> supplying the copy on top, same as every
  // earlier pass. See that file's DATA comment for the full per-slide
  // crop/aspect notes.
  onboardingInterview: require("./img_onboarding_interview.png"),
  onboardingFeedback: require("./img_onboarding_feedback.png"),
  onboardingJobAlert: require("./img_onboarding_job_alert.png"),
  onboardingResumeScan: require("./img_onboarding_resume_scan.png"),
  onboardingLearning: require("./img_onboarding_learning.png"),
  // Learning Courses' own first-time full-screen onboarding banner (product
  // request: "when user comes to the learning course screen for the first
  // time, a full screen banner should appear first... its like an
  // onboarding for the learning course feature", explicitly pointing at
  // this exact image to use). Shown once via
  // src/more/LearningCoursesOnboarding.tsx, gated on
  // EKeyAsyncStorage.learningCoursesOnboardingSeen — separate from the
  // pre-signup onboarding carousel above, which this user never reaches
  // again post-signup. Product-supplied full-bleed hero image, 1080x1920
  // (9:16, matches a full-screen phone banner with no cropping needed).
  learningOnboarding: require("./img_learning_onboarding.png"),
  // Job Alerts' own first-time full-screen onboarding banner (product
  // request: "I also want an onboarding illustration for Job alerts the
  // same way you did for the learning course", pointing at this exact
  // marketing image — "Saveur brings jobs to you / Based on your desired
  // role"). Shown once via src/more/JobAlertsOnboarding.tsx, gated on
  // EKeyAsyncStorage.jobAlertsOnboardingSeen. Product-supplied image was
  // letterboxed with black pillarbox bars on a 2528x2528 canvas — cropped
  // to just the real illustration content (1609x2528) so there's no black
  // strip down either side when this renders full-bleed.
  jobAlertsOnboarding: require("./img_job_alerts_onboarding.png"),
};
