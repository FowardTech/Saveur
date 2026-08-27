import {
  Icon,
  Layout,
  Spinner,
  StyleService,
  TopNavigation,
  useStyleSheet,
  useTheme,
} from "@ui-kitten/components";
import Container from "components/Container";
import Content from "components/Content";
import NavigationAction from "components/NavigationAction";
import Text from "components/Text";
import useLayout from "hooks/useLayout";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, View } from "react-native";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "navigation/types";
import { AuthContext } from "../../../AuthContext";
import { globalStyle } from "styles/globalStyle";

// Same 6 goals + same eva outline icons as src/auth/Signup/SignupFirstStep.tsx
// (the goal picker shown once, at signup) — this screen is the "change it
// later" equivalent, reachable from Profile/More any time. Previously used
// mismatched leftover artwork from the old "Caren" caregiving app template
// (e.g. a pet-care icon for "Career Change") and tapping a card did nothing
// beyond a local highlight — now it persists the choice via
// AuthContext.updateProfile (PATCH /api/users/me, profile.goals) and
// confirms with a save button, same pattern as other settings screens in
// this app (e.g. JobAlerts's preferences editor).
//
// The card background used to be an ImageBackground over
// assets/images/img_fill.png / img_fillActive.png — flat PNGs with the
// "unselected" state baked in as light gray, which never adapted to dark
// mode (a hardcoded light-mode card behind the icon regardless of theme —
// see the screenshot report of washed-out white cards on a dark screen).
// SignupFirstStep.tsx hit and fixed this exact issue already for the same
// 6 cards at signup, by swapping the PNG ImageBackground for a plain themed
// View using background-basic-color-2 / color-primary-500 — replicating
// that fix here so the "change it later" screen matches.
const GOALS = [
  { titleKey: "auth:goal_new_job", defaultValue: "Land a New Job", icon: "briefcase-outline" },
  { titleKey: "auth:goal_career_change", defaultValue: "Career Change", icon: "swap-outline" },
  { titleKey: "auth:goal_promotion", defaultValue: "Promotion", icon: "trending-up-outline" },
  { titleKey: "auth:goal_return_to_work", defaultValue: "Return to Work", icon: "log-in-outline" },
  { titleKey: "auth:goal_internship", defaultValue: "Internship / Grad Job", icon: "book-open-outline" },
  { titleKey: "auth:goal_executive", defaultValue: "Executive Move", icon: "star-outline" },
  // Product request item: "We need to add more goal list to the goal
  // section" — kept in sync with the same 4 additions in
  // src/auth/Signup/SignupFirstStep.tsx (see that file's comment).
  { titleKey: "auth:goal_start_business", defaultValue: "Start a Business", icon: "bulb-outline" },
  { titleKey: "auth:goal_relocate", defaultValue: "Relocate / Work Abroad", icon: "globe-outline" },
  { titleKey: "auth:goal_grow_network", defaultValue: "Grow My Network", icon: "people-outline" },
  { titleKey: "auth:goal_explore_options", defaultValue: "Explore My Options", icon: "compass-outline" },
];

const ChangeCareType = () => {
  const theme = useTheme();
  const { width } = useLayout();
  const { t } = useTranslation(["common", "auth", "more"]);
  const styles = useStyleSheet(themedStyles);
  const { goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const { profile, updateProfile } = React.useContext(AuthContext);

  const items = React.useMemo(
    () => GOALS.map(g => ({ ...g, title: t(g.titleKey, { defaultValue: g.defaultValue }) })),
    [t],
  );

  // Pre-select whatever the user already has saved (profile.goals[0]) rather
  // than always defaulting to the first card, so reopening this screen shows
  // the real current choice.
  const [active, setActive] = React.useState<number>(() => {
    const current = profile?.goals?.[0];
    const idx = current ? items.findIndex(g => g.title === current) : -1;
    return idx >= 0 ? idx : 0;
  });
  const [isSaving, setIsSaving] = React.useState(false);

  const onSave = React.useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateProfile({ goals: [items[active].title] });
      goBack();
    } catch (e: any) {
      Alert.alert(
        t("more:career_goal_save_failed", { defaultValue: "Couldn't save that" }),
        e?.message ?? t("common:try_again_later", { defaultValue: "Please try again in a moment." }),
      );
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, updateProfile, items, active, goBack, t]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t("more:career_goal", { defaultValue: "Career Goal" })}
      />
      <Content contentContainerStyle={styles.content}>
        <Layout style={styles.wrapper}>
          {items.map((item, i) => {
            const isActive = active === i;
            return (
              <Pressable
                style={{
                  // Product report: "This UI and its layout is bad the
                  // cards are arrange irregularly. Maybe you should make
                  // them grids of 3 or 4" — was a 2-column layout using
                  // `justifyContent: "space-between"` on the wrapper, which
                  // stretches a short last row's single leftover card all
                  // the way to one edge with a big empty gap next to it
                  // (10 cards / 2 columns leaves exactly that on the final
                  // row) — that's what actually read as "irregular", not
                  // the card styling itself. 3 fixed-width columns (matches
                  // wrapper's columnGap * 2 + its 24px*2 padding, now with
                  // justifyContent: "flex-start" instead of space-between —
                  // see wrapper's own comment) lays out cleanly regardless
                  // of how many cards land in the last row.
                  width: (width - 48 - 20 * 2) / 3,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                key={i}
                onPress={() => setActive(i)}
              >
                <Layout key={i} style={styles.cardWrap}>
                  <View
                    style={[
                      styles.background,
                      {
                        backgroundColor: isActive
                          ? theme["color-primary-500"]
                          : theme["background-basic-color-2"],
                      },
                    ]}
                  >
                    <Icon
                      pack="eva"
                      name={item.icon}
                      style={{
                        // Product report: "reduce the size of this goal
                        // cards and reduce the icons too they are just too
                        // big" — was 40x40 on an 120x120 card; both shrunk
                        // together (see `background` below) so the icon
                        // still reads at roughly the same proportion of the
                        // card, not just smaller inside unchanged empty
                        // space.
                        width: 26,
                        height: 26,
                        tintColor: isActive
                          ? theme["text-control-color"]
                          : theme["text-placeholder-color"],
                      }}
                    />
                  </View>
                  <Text
                    center
                    mt={16}
                    category="h8"
                    bold
                    status={isActive ? "link" : "placeholder"}
                  >
                    {item.title}
                  </Text>
                </Layout>
              </Pressable>
            );
          })}
        </Layout>
        <Pressable
          disabled={isSaving}
          onPress={onSave}
          style={[
            styles.saveBtn,
            { backgroundColor: theme["color-primary-500"], opacity: isSaving ? 0.6 : 1 },
          ]}
        >
          {isSaving ? (
            <Spinner size="small" status="control" />
          ) : (
            <Text category="h8" bold status="control">
              {t("common:save", { defaultValue: "Save" })}
            </Text>
          )}
        </Pressable>
      </Content>
    </Container>
  );
};

export default ChangeCareType;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  background: {
    // Product report: "these cards don't have box shadow. They should.
    // How does users know they are cards?" -- this chip never carried
    // globalStyle.card's shadow at all (it's a plain themed View, not a
    // card style spread -- see this file's own history on why it was
    // rebuilt that way). Spread in now so these read as real, tappable
    // cards against the page the same way every other card in the app
    // does, in both the unselected (white) and selected (blue) fill.
    ...globalStyle.card,
    // Product report: "reduce the size of this goal cards" — was a fixed
    // 120x120. Shrunk to 84x84 (see the icon's own comment above for the
    // matching icon-size reduction).
    width: 84,
    height: 84,
    // App-wide card standardization (product request: "all cards in this
    // app has a border radius of 13 or 14") — was a formula-derived
    // squircle radius (120 * 0.32 = 38.4, a much rounder "chip" shape than
    // the rest of the app's cards). Google-style furnishing pass (see
    // styles/globalStyle.ts's `card`) -- 14 -> 20, matching every other
    // card in the app again.
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  // BUG FIX (product report: "remove the subtle light green color I am
  // seeing there") — this and cardWrap below are plain <Layout>s with no
  // explicit `level` prop, which Eva's own mapping.json defaults to
  // level="1" (background-basic-color-1 -> constants/theme/appTheme.json's
  // color-basic-200, "#F6FAF8" — a barely-there mint tint left over from an
  // earlier reskin pass, see styles/globalStyle.ts's card-shadow history).
  // Sitting on top of Container's actual level="3" page background
  // (#F0F0F0, neutrally gray), that faint green shows through in every gap
  // between/around the grid's cards. Same root cause + same fix
  // (backgroundColor: 'transparent') as SharedWithMe.tsx's tabBarWrap — see
  // that style's own comment for the first time this exact bug was caught.
  wrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    // Product report: "the cards are arrange irregularly... make them
    // grids of 3 or 4" — `space-between` on a wrapping row spreads a
    // short final row's leftover card(s) apart from wherever they'd
    // naturally sit, which is what actually produced the "irregular"
    // look (see the Pressable width's own comment above). `flex-start`
    // plus explicit rowGap/columnGap lays every row out identically,
    // whether it's full or not.
    justifyContent: "flex-start",
    // BUG FIX (product report, screenshot: "Some of this cards are not
    // aligning well. Some rows look zig-zag") — with no alignItems set
    // here, flexbox's default cross-axis behavior is "stretch": every
    // Pressable in a row gets stretched to match the tallest sibling in
    // that row. Labels vary between 1 line ("Promotion") and 2 lines
    // ("Internship / Grad Job"), so a 2-line card's row stretched its
    // 1-line neighbors taller too -- and since each Pressable centers its
    // own content (justifyContent/alignItems: "center"), the icon chip in
    // a stretched 1-line card got pushed down to stay centered, while the
    // 2-line card's chip stayed near the top. That per-row height mismatch
    // is exactly what read as a "zig-zag". `flex-start` stops the stretch
    // -- every card keeps its own natural height and all icon chips now
    // align along the same top edge in every row, regardless of how many
    // lines the label below wraps to.
    alignItems: "flex-start",
    padding: 24,
    // Tightened alongside the smaller card size above so the grid doesn't
    // end up with disproportionately large gaps around now-smaller cards.
    rowGap: 24,
    columnGap: 20,
    backgroundColor: "transparent",
  },
  // Wraps each card's colored chip + label — see wrapper's own comment
  // above for why this needs to be explicitly transparent too (it's the
  // direct parent of the rounded chip, so its greenish level-1 default
  // showed through as a tint right at the chip's own corners, not just in
  // the grid's outer gaps).
  cardWrap: {
    backgroundColor: "transparent",
  },
  saveBtn: {
    marginHorizontal: 24,
    marginTop: 8,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
});
