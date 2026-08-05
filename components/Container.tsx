import React from "react";
import { Layout, LayoutProps } from "@ui-kitten/components";
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
