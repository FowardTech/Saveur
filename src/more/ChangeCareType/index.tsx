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
                  width: (width - 32 - 48) / 2,
                  justifyContent: "center",
                  alignItems: "center",
                }}
                key={i}
                onPress={() => setActive(i)}
              >
                <Layout key={i}>
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
                        width: 40,
                        height: 40,
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
    width: 120,
    height: 120,
    // Rounded corners used to come baked into the fill/fillActive PNGs
    // (see the comment above onSave) — now that this is a plain themed
    // View, the radius needs to be set explicitly to keep the same
    // rounded-square "chip" shape.
    borderRadius: 120 * 0.32,
    justifyContent: "center",
    alignItems: "center",
  },
  wrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 24,
    rowGap: 40,
    columnGap: 32,
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
