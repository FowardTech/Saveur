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
  const bodyBackgroundOverride =
    level === undefined && appTheme !== "dark" ? { backgroundColor: theme["background-page-body"] } : null;
  return (
    <Layout
      level={resolvedLevel}
      {...props}
      style={[
        { flex: 1 },
        useSafeArea && { paddingTop: top, paddingBottom: bottom },
        bodyBackgroundOverride,
        style,
      ]}
    >
      {children}
    </Layout>
  );
};

export default Container;
