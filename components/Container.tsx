import React from "react";
import { Layout, LayoutProps } from "@ui-kitten/components";
import useLayout from "hooks/useLayout";
import ThemeContext from "../ThemeContext";

interface ContainerProps extends LayoutProps {
  useSafeArea?: boolean;
}

// REVERTED (explicit follow-up product request — "change the app body
// background from gray to white"): light mode's body used to default to
// level="3" (#F0F0F0, a real visible gray — see the git history on this
// comment for the earlier "make the body gray so white cards are visible"
// request that introduced it). Now defaults to level="2" (#FFFFFF, the
// same pure white every card in this app is already built on) instead —
// see globalStyle.ts's `card` style for how card-vs-page separation is
// still preserved without a gray page: Android has no shadow to fall back
// on (elevation was explicitly stripped from cardShadow per an earlier
// "remove the box shadow on Android" request), so `card` now also carries
// a subtle Android-only hairline border. iOS still gets its real soft
// shadow, unaffected either way.
//
// THEME-AWARE, not a single hardcoded level, because constants/theme/
// {light,dark}.json number their background-basic-color-N scale in
// opposite directions: light.json's level 2 (#FFFFFF) is the single
// LIGHTEST/whitest tone, with level 1 (#F6FAF8) a hair softer and level 3+
// (#F0F0F0, #E0E0E0...) trending genuinely grayer. dark.json instead runs
// monotonically DARK-to-LIGHT (level 1 #12121F darkest/base → level 2
// #1B1B2E → level 3 #2A2A42 → ...), the standard "higher elevation =
// lighter" dark-theme convention — using level 2 there would make the
// PAGE lighter than a level-2 card, inverting the elevation relationship
// (cards would look sunken instead of raised). Level 1 is already correct
// for dark mode and is untouched by this change.
const Container: React.FC<ContainerProps> = ({
  children,
  style,
  useSafeArea = true,
  level,
  ...props
}) => {
  const { top, bottom } = useLayout();
  const { theme: appTheme } = React.useContext(ThemeContext);
  const resolvedLevel = level ?? (appTheme === "dark" ? "1" : "2");
  return (
    <Layout
      level={resolvedLevel}
      {...props}
      style={[
        { flex: 1 },
        useSafeArea && { paddingTop: top, paddingBottom: bottom },
        style,
      ]}
    >
      {children}
    </Layout>
  );
};

export default Container;
