import React from "react";
import { Layout, LayoutProps } from "@ui-kitten/components";
import useLayout from "hooks/useLayout";
import ThemeContext from "../ThemeContext";

interface ContainerProps extends LayoutProps {
  useSafeArea?: boolean;
}

// Redesign v2 (full reskin, product bug report — "the body background of
// the app should be gray so that the white cards can be visible"): every
// one of the ~70 screens that render through this shared Container passes
// no explicit `level` prop, so they all fell back to UI Kitten's own
// Layout default (level="1", eva mapping.json's Layout.variantGroups.level
// marks "1" as `default: true`).
//
// THEME-AWARE, not a single hardcoded level, because constants/theme/
// {light,dark}.json number their background-basic-color-N scale in
// opposite directions: light.json's level 2 (#FFFFFF) is the single
// LIGHTEST/whitest tone (what every card in this app is built on), with
// both level 1 (#FAFAFA) and level 3+ (#F0F0F0, #E0E0E0...) trending
// grayer — so level 3 makes a real gray page a level-2 white card
// visibly pops against. dark.json instead runs monotonically DARK-to-
// LIGHT (level 1 #12121F darkest/base → level 2 #1B1B2E → level 3
// #2A2A42 → ...), the standard "higher elevation = lighter" dark-theme
// convention — using level 3 there would make the PAGE lighter than a
// level-2 card, inverting the elevation relationship (cards would look
// sunken instead of raised). Level 1 (the original default) is already
// correct for dark mode; only light mode needed the change.
const Container: React.FC<ContainerProps> = ({
  children,
  style,
  useSafeArea = true,
  level,
  ...props
}) => {
  const { top, bottom } = useLayout();
  const { theme: appTheme } = React.useContext(ThemeContext);
  const resolvedLevel = level ?? (appTheme === "dark" ? "1" : "3");
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
