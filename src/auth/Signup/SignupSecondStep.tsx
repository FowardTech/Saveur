import React, {memo} from 'react';
import {TouchableOpacity, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Input,
  Icon,
  Button,
} from '@ui-kitten/components';
import {NavigationProp, RouteProp, useNavigation, useRoute} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {AuthStackParamList, RootStackParamList} from 'navigation/types';
import {COUNTRIES} from 'constants/countries';
import CtaButton from 'components/CtaButton';

// Step 2 of signup: which countries is the user open to working in? This
// used to be a react-native-maps address picker (leftover from the
// caregiver template, and it required a Google Maps API key that isn't
// configured — it was crashing on Android with "API key not found"). A
// literal map pin doesn't fit "preferred countries" as a job-search
// preference anyway, so this is now a simple searchable multi-select list —
// no native map dependency needed. The list itself now lives in
// constants/countries.ts so src/more/JobPreferences.tsx (the "change it
// later" settings screen) shares the exact same list instead of drifting.

const SignupSecondStep = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'SignupSecondStep'>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['auth', 'common', 'success', 'countries']);

  // COUNTRIES (constants/countries.ts) stays a fixed list of stable English
  // canonical values -- that's what's actually stored (preferredCountries)
  // and matched against elsewhere (job alert filtering, etc.), so it can't
  // change per-language. This just looks up a display label for whichever
  // language is active; i18n/language/*/countries.json's keys are the exact
  // canonical English strings, falling back to the English name itself for
  // any language that hasn't got (or doesn't need) its own translation.
  const countryLabel = React.useCallback(
    (country: string) => t(country, {ns: 'countries', defaultValue: country}),
    [t],
  );

  const goal = route.params?.goal;
  const locale = route.params?.locale;
  const [query, setQuery] = React.useState('');
  const [preferredCountries, setPreferredCountries] = React.useState<string[]>([]);

  // Job titles/roles/positions the user is searching for or preparing to
  // interview for — free text, not a fixed list like countries, since job
  // titles are far too varied to enumerate. Drives job-alert matching (see
  // constants/Types.tsx's JobAlertProps + services/jobAlertsService.ts) — a
  // job alert can't match anything without this.
  const [roleDraft, setRoleDraft] = React.useState('');
  const [desiredRoles, setDesiredRoles] = React.useState<string[]>([]);

  const addRole = () => {
    const trimmed = roleDraft.trim();
    if (!trimmed) return;
    setDesiredRoles(prev => (prev.some(r => r.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]));
    setRoleDraft('');
  };
  const removeRole = (role: string) => {
    setDesiredRoles(prev => prev.filter(r => r !== role));
  };

  const filtered = React.useMemo(
    () => COUNTRIES.filter(c => {
      const q = query.toLowerCase();
      return c.toLowerCase().includes(q) || countryLabel(c).toLowerCase().includes(q);
    }),
    [query, countryLabel],
  );

  const toggleCountry = (country: string) => {
    setPreferredCountries(prev =>
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country],
    );
  };

  const onContinue = () => {
    navigate('AuthStack', {
      screen: 'SignupThirdStep',
      params: {
        goals: goal ? [goal] : [],
        preferredCountries,
        desiredRoles,
        locale,
      },
    });
  };

  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text mt={16}>{t('auth:heading_signup_2')}</Text>
        {/* BUG FIX (custom fonts not rendering on Android): see Text.tsx's
            comment — an explicit numeric fontWeight fighting a weight-named
            custom fontFamily breaks Android's font file lookup. Removed. */}
        <Text mt={8} mb={24} category="h2" bold>
          {t('auth:title_signup_2')}
        </Text>

        <Text category="h7" bold mb={4}>
          {t('auth:desired_roles_title', {defaultValue: 'Roles you\'re targeting'})}
        </Text>
        <Text category="h9-s" status="placeholder" mb={12}>
          {t('auth:desired_roles_subtitle', {
            defaultValue: "We'll alert you when a matching job is posted online — e.g. \"Product Manager\", \"Senior Software Engineer\".",
          })}
        </Text>
        <View style={styles.searchWrap}>
          <Input
            placeholder={t('auth:desired_roles_placeholder', {defaultValue: 'Type a job title and add it'})}
            value={roleDraft}
            onChangeText={setRoleDraft}
            onSubmitEditing={addRole}
            returnKeyType="done"
            accessoryRight={props => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={addRole}
                disabled={!roleDraft.trim()}
                style={styles.accessoryRightSpacing}>
                <Icon {...props} pack="eva" name="plus-outline" />
              </TouchableOpacity>
            )}
            style={styles.search}
            textStyle={styles.searchText}
            status="basic"
            size="large"
          />
        </View>
        {desiredRoles.length > 0 ? (
          <View style={[styles.chipsWrap, {marginBottom: 24}]}>
            {desiredRoles.map(role => (
              <TouchableOpacity
                key={role}
                activeOpacity={0.7}
                onPress={() => removeRole(role)}
                style={[styles.chip, {backgroundColor: theme['background-basic-color-3']}]}>
                <Text category="h9" bold>
                  {role}
                </Text>
                <Icon
                  pack="eva"
                  name="close-outline"
                  style={[globalStyle.icon16, {tintColor: theme['text-basic-color'], marginLeft: 6}]}
                />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <Text category="h7" bold mb={12}>
          {t('auth:preferred_countries_title', {defaultValue: 'Countries you\'d work in'})}
        </Text>
        <View style={styles.searchWrap}>
          <Input
            placeholder={t('auth:enter_address_zip_code_')}
            value={query}
            onChangeText={setQuery}
            accessoryLeft={props => (
              <Icon {...props} style={[props.style, styles.accessoryLeftSpacing]} pack="assets" name="search" />
            )}
            style={styles.search}
            textStyle={styles.searchText}
            status="basic"
            size="large"
          />
        </View>
        {preferredCountries.length > 0 ? (
          <View style={styles.chipsWrap}>
            {preferredCountries.map(country => (
              <TouchableOpacity
                key={country}
                activeOpacity={0.7}
                onPress={() => toggleCountry(country)}
                style={[styles.chip, {backgroundColor: theme['color-primary-500']}]}>
                <Text category="h9" status="control" bold>
                  {countryLabel(country)}
                </Text>
                <Icon
                  pack="eva"
                  name="close-outline"
                  style={[globalStyle.icon16, {tintColor: theme['text-control-color'], marginLeft: 6}]}
                />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.list}>
          {filtered.map(country => {
            const selected = preferredCountries.includes(country);
            return (
              <TouchableOpacity
                key={country}
                activeOpacity={0.7}
                onPress={() => toggleCountry(country)}
                style={styles.row}>
                <Text category="h8" status={selected ? 'link' : 'basic'}>
                  {countryLabel(country)}
                </Text>
                {selected ? (
                  <Icon
                    pack="eva"
                    name="checkmark-circle-2"
                    style={[globalStyle.icon20, {tintColor: theme['text-basic-color']}]}
                  />
                ) : (
                  <Icon
                    pack="eva"
                    name="radio-button-off-outline"
                    style={[globalStyle.icon20, {tintColor: theme['text-placeholder-color']}]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </Content>
      <CtaButton
        style={styles.button}
        children={t('auth:choose_this_location')}
        onPress={onContinue}
        disabled={preferredCountries.length === 0}
        size="large"
      />
    </Container>
  );
});

export default SignupSecondStep;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  // UI Kitten's <Input> splits its `style` prop itself: anything in RN's
  // "flex style" list (width, alignSelf, margin*, padding* included — see
  // node_modules/@ui-kitten/components/devsupport/services/props/props.service.js's
  // FlexStyleProps) is routed to the *outer*, invisible touchable wrapper;
  // only paint-only props (backgroundColor, borderRadius, shadow*) reach the
  // visual pill (its `inputContainer`, which the library hardcodes to
  // width: '100%' of that outer wrapper regardless of what we pass). That's
  // why paddingHorizontal in `search` below never widened the *visible* pill
  // and why width/alignSelf here had no effect either — both were landing on
  // a wrapper whose own width is being fought over elsewhere. Wrapping the
  // Input in our own `searchWrap` View pins the width ourselves, outside of
  // Eva's style-splitting entirely, and `searchText` (passed via the
  // separate `textStyle` prop, which is NOT split — see the component's
  // `style={[evaStyle.text, styles.text, platformStyles.text, textStyle]}`)
  // adds the actual breathing room around the text/icon.
  searchWrap: {
    width: '100%',
  },
  search: {
    ...globalStyle.shadow,
    marginBottom: 16,
    backgroundColor: 'background-basic-color-2',
  },
  searchText: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  // Accessory icons (the "+" on the role field, the search glyph on the
  // country field) sit inside the same full-bleed row as the text — since
  // that row can't take padding either (same style-splitting issue above),
  // they were rendering flush against the pill's rounded edge. Margin isn't
  // split the same way when applied directly to the icon/its wrapper
  // (rather than via the Input's own `style`), so this pushes them in from
  // the edge to match the breathing room `searchText` gives the text.
  accessoryLeftSpacing: {
    marginLeft: 14,
  },
  accessoryRightSpacing: {
    marginRight: 14,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'background-basic-color-3',
  },
  button: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
  },
});
