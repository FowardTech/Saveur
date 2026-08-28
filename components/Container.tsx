import React from "react";
import { Layout, LayoutProps, useTheme } from "@ui-kitten/components";
import useLayout from "hooks/useLayout";
import ThemeContext from "../ThemeContext";

interface ContainerProps extends LayoutProps {
  useSafeArea?: boolean;
}

// RE-REVERTED (explicit follow-up product request — "lets change the app
// background body back to the gray color"): light mode's body briefly
// defaulted to level="2" (#FFFFFF, pure white — see this comment's own git
// history for that request). Back to level="3" (#F0F0F0, a real visible
// gray) now, so white cards read as distinct raised surfaces against the
// page again. Card shadows themselves have separately been zeroed out app-
// wide per a follow-up request (see globalStyle.ts's `cardShadow`) — with
// no page/card color contrast AND no shadow, cards would have been
// indistinguishable from the page, which is the reason this reverts too.
//
// THEME-AWARE, not a single hardcoded level, because constants/theme/
// {light,dark}.json number their background-basic-color-N scale in
// opposite directions: light.json's level 3 (#F0F0F0) trends genuinely
// grayer than level 1/2. dark.json instead runs monotonically DARK-to-
// LIGHT (level 1 #12121F darkest/base → level 2 #1B1B2E → level 3 #2A2A42
// → ...), the standard "higher elevation = lighter" dark-theme convention
// — using level 3 there would make the PAGE lighter than a level-2 card,
// inverting the elevation relationship (cards would look sunken instead of
// raised). Level 1 is already correct for dark mode and is untouched by
// this change.
const Container: React.FC<ContainerProps> = ({
  children,
  style,
  useSafeArea = true,
  level,
  ...props
}) => {
  const { top, bottom } = useLayout();
  const { theme: appTheme } = React.useContext(ThemeContext);
  const theme = useTheme();
  const resolvedLevel = level ?? (appTheme === "dark" ? "1" : "3");
  // Product request ("give the app background body a very subtle light
  // blue color"): the page body used to just be `background-basic-color-3`
  // (light mode: #F0F0F0, a flat neutral gray — see this file's own git
  // history above for why level=3 was picked). That same token is also
  // shared by a bunch of small UI elements throughout the app (badge
  // pills, inactive date circles, etc. — see e.g. HomeSrc.tsx's
  // checkInButton/checkInBadgesButton), so recoloring the TOKEN itself
  // would have tinted all of those too, not just the page background this
  // request is actually about. A separate `background-page-body` token
  // (added to both theme JSONs) keeps this scoped to exactly the one
  // surface being asked for — only applied when the caller hasn't already
  // passed their own explicit `level` (i.e. this is genuinely being used in
  // its default "page body" role, not some other custom-leveled surface),
  // and only in light mode: dark mode's existing background-basic-color-1
  // (#12121F) already reads as a subtle dark navy/blue, so it's left
  // untouched rather than risking the elevation contrast this file's own
  // comment above already carefully reasons through.
  //
  // REVERTED (pre-launch polish pass, product request: "give the app
  // background gray instead of the subtle blue background") — light.json's
  // `background-page-body` is back to #F0F0F0, the same flat neutral gray
  // level=3 used before the light-blue request above. The token/override
  // mechanism itself stays (still only light mode, still skipped when a
  // caller passes its own `level`) since it's still the one clean place to
  // recolor just the page body without touching the shared badge-pill/
  // date-circle uses of `background-basic-color-3` -- only the color value
  // in the theme JSON changed.
  //
  // REDESIGN (product reference — an iOS Settings app screenshot: "I want
  // us to use that type of gray background for the app background... and
  // lets see how it looks like") — `background-page-body` briefly became
  // #F2F2F7, the real iOS systemGroupedBackground light color the
  // reference screenshot itself uses, in place of the flatter #F0F0F0 gray
  // above.
  //
  // RE-REVERTED (product follow-up: "Change the app background back to
  // white and then give the white cards their borders back") — back to
  // #FFFFFF. White cards go back to defining themselves via a real border
  // again instead of a page/card color contrast (see globalStyle.card's
  // own border restoration), so the page itself no longer needs to be a
  // visibly different gray for cards to read as distinct surfaces.
  const bodyBackgroundOverride =
    level === undefined && appTheme !== "dark" ? { backgroundColor: theme["background-page-body"] } : null;
  // BUG FIX (product report: "the container holding pages together is
  // overlapping and hiding some part of the content under each screen
  // title header... move the overall container down a little bit") — this
  // is the one shared Container every screen's TopNavigation + Content
  // sits inside, so its top safe-area padding is exactly "the overall
  // container" the report means. `top` alone (the raw safe-area-inset
  // value — just tall enough to clear the status bar/notch itself) left no
  // breathing room between the very top edge and the header content above
  // it, which on several screens read as the first bit of the TopNavigation
  // row (or the screen content just below it) sitting too close to/under
  // the notch/status bar. EXTRA_TOP_CLEARANCE adds a small fixed cushion
  // on top of the real inset instead of replacing it, so this still adapts
  // correctly per-device (notch vs. no notch) rather than hardcoding one
  // absolute number for every phone.
  const EXTRA_TOP_CLEARANCE = 8;
  return (
    <Layout
      level={resolvedLevel}
      {...props}
      style={[
        { flex: 1 },
        useSafeArea && { paddingTop: top + EXTRA_TOP_CLEARANCE, paddingBottom: bottom },
        bodyBackgroundOverride,
        style,
      ]}
    >
      {children}
    </Layout>
  );
};

export default Container;
