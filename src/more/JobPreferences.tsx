import React, {memo} from 'react';
import {Alert, TouchableOpacity, View} from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Input,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import {useTranslation} from 'react-i18next';
import NavigationAction from 'components/NavigationAction';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {COUNTRIES, countryFlagEmoji} from 'constants/countries';
import {AuthContext} from '../../AuthContext';

// "Change it later" equivalent of src/auth/Signup/SignupSecondStep.tsx — was
// previously only collected once, at signup, with no way for a user to add a
// new target role or open up to a new country afterward without deleting and
// recreating their account. Deliberately reuses the exact same interaction
// pattern (free-text add-a-role chips + searchable multi-select country
// list) and even the same i18n keys (auth:desired_roles_title etc.) so this
// feels like the same feature, not a re-implementation — the only real
// difference is this screen loads the user's EXISTING profile.desiredRoles /
// profile.preferredCountries as a starting point and persists via
// AuthContext.updateProfile (PATCH /api/users/me) behind an explicit Save
// button, rather than forwarding the choice to the next signup step.
const JobPreferences = memo(() => {
  const {goBack} = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['auth', 'more', 'common', 'countries']);
  const {profile, updateProfile} = React.useContext(AuthContext);

  // See SignupSecondStep.tsx's identical helper — COUNTRIES stays a fixed
  // list of stable English canonical values (what's actually stored/synced
  // via updateProfile), this just looks up a display label for the active
  // language, falling back to the English name itself when untranslated.
  const countryLabel = React.useCallback(
    (country: string) => t(country, {ns: 'countries', defaultValue: country}),
    [t],
  );

  const [query, setQuery] = React.useState('');
  const [preferredCountries, setPreferredCountries] = React.useState<string[]>(
    () => profile?.preferredCountries ?? [],
  );

  const [roleDraft, setRoleDraft] = React.useState('');
  const [desiredRoles, setDesiredRoles] = React.useState<string[]>(
    () => profile?.desiredRoles ?? [],
  );
  const [isSaving, setIsSaving] = React.useState(false);

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

  const onSave = React.useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateProfile({desiredRoles, preferredCountries});
      goBack();
    } catch (e: any) {
      Alert.alert(
        t('more:job_preferences_save_failed', {defaultValue: "Couldn't save that"}),
        e?.message ?? t('common:try_again_later', {defaultValue: 'Please try again in a moment.'}),
      );
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, updateProfile, desiredRoles, preferredCountries, goBack, t]);

  return (
    <Container style={styles.container}>
      <TopNavigation
        accessoryLeft={() => <NavigationAction />}
        title={t('more:job_preferences', {defaultValue: 'Target Roles & Countries'})}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h7" bold mb={4}>
          {t('auth:desired_roles_title', {defaultValue: "Roles you're targeting"})}
        </Text>
        <Text category="h9-s" status="placeholder" mb={12}>
          {t('auth:desired_roles_subtitle', {
            defaultValue: 'We\'ll alert you when a matching job is posted online — e.g. "Product Manager", "Senior Software Engineer".',
          })}
        </Text>
        <View style={styles.searchWrap}>
          <Input
            placeholder={t('auth:desired_roles_placeholder', {defaultValue: 'Type a job title and add it'}).toString()}
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
                style={[styles.chip, {backgroundColor: theme['background-basic-color-2'], borderColor: theme['background-basic-color-4']}]}>
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
        ) : (
          <Text category="h10" status="placeholder" mb={24}>
            {t('more:job_preferences_no_roles', {defaultValue: 'No target roles added yet.'})}
          </Text>
        )}

        <Text category="h7" bold mb={12}>
          {t('auth:preferred_countries_title', {defaultValue: "Countries you'd work in"})}
        </Text>
        <View style={styles.searchWrap}>
          <Input
            placeholder={t('auth:enter_address_zip_code_').toString()}
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
                style={[styles.chip, {backgroundColor: theme['color-primary-500'], borderColor: theme['color-primary-600']}]}>
                <Text category="h9" status="control" bold>
                  {countryFlagEmoji(country) ? `${countryFlagEmoji(country)} ` : ''}{countryLabel(country)}
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
                {/* Product request: country flags beside each option, same
                    fix as SignupSecondStep.tsx (shared list/pattern). */}
                <Text category="h8" status={selected ? 'link' : 'basic'}>
                  {countryFlagEmoji(country) ? `${countryFlagEmoji(country)} ` : ''}{countryLabel(country)}
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
      <TouchableOpacity
        disabled={isSaving}
        onPress={onSave}
        style={[styles.saveBtn, {backgroundColor: theme['color-primary-500'], opacity: isSaving ? 0.6 : 1}]}>
        {isSaving ? (
          <Spinner size="small" status="control" />
        ) : (
          <Text category="h8" bold status="control">
            {t('common:save', {defaultValue: 'Save'})}
          </Text>
        )}
      </TouchableOpacity>
    </Container>
  );
});

export default JobPreferences;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
  },
  // See SignupSecondStep.tsx's identical comment — UI Kitten's <Input>
  // splits its `style` prop between an outer touchable wrapper and the
  // visible pill, so width/padding have to be applied via a wrapping View
  // (searchWrap) and the separate `textStyle` prop instead.
  searchWrap: {
    width: '100%',
  },
  // Product request ("make text inputs all through the app consistent in
  // design") — was `...globalStyle.shadow` (a real box shadow, and a
  // different border-radius/fill convention than every other Input in the
  // app). Now shares the shared globalStyle.inputField/inputText look.
  search: {
    ...globalStyle.inputField,
    marginBottom: 16,
  },
  searchText: {
    ...globalStyle.inputText,
  },
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
  // Product request (reference screenshot: pill-shaped tags with a visible
  // border) — borderRadius:99 already made these pills, but with no border
  // they only read as a filled shape, not the bordered-pill "form field"
  // look the reference uses. borderWidth/borderColor are added per-usage
  // below (role chips vs. country chips use different fills, so need
  // different border tones to still read against each).
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    borderWidth: 1,
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
  saveBtn: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
