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

// Step 2 of signup: which countries is the user open to working in? This
// used to be a react-native-maps address picker (leftover from the
// caregiver template, and it required a Google Maps API key that isn't
// configured — it was crashing on Android with "API key not found"). A
// literal map pin doesn't fit "preferred countries" as a job-search
// preference anyway, so this is now a simple searchable multi-select list —
// no native map dependency needed.
const COUNTRIES = [
  'Remote - Anywhere',
  'United States',
  'United Kingdom',
  'Canada',
  'Ireland',
  'Germany',
  'France',
  'Netherlands',
  'Australia',
  'New Zealand',
  'Singapore',
  'India',
  'United Arab Emirates',
  'Nigeria',
  'South Africa',
  'Brazil',
  'Mexico',
  'Japan',
  'South Korea',
];

const SignupSecondStep = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<AuthStackParamList, 'SignupSecondStep'>>();
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const {t} = useTranslation(['auth', 'common', 'success']);

  const goal = route.params?.goal;
  const [query, setQuery] = React.useState('');
  const [preferredCountries, setPreferredCountries] = React.useState<string[]>([]);

  const filtered = React.useMemo(
    () => COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase())),
    [query],
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
      },
    });
  };

  return (
    <Container style={styles.container}>
      <TopNavigation accessoryLeft={<NavigationAction />} />
      <Content padder contentContainerStyle={styles.content}>
        <Text mt={16}>{t('auth:heading_signup_2')}</Text>
        <Text mt={8} mb={24} category="h2">
          {t('auth:title_signup_2')}
        </Text>
        <Input
          placeholder={t('auth:enter_address_zip_code_')}
          value={query}
          onChangeText={setQuery}
          accessoryLeft={props => <Icon {...props} pack="assets" name="search" />}
          style={styles.search}
          status="basic"
          size="large"
        />
        {preferredCountries.length > 0 ? (
          <View style={styles.chipsWrap}>
            {preferredCountries.map(country => (
              <TouchableOpacity
                key={country}
                activeOpacity={0.7}
                onPress={() => toggleCountry(country)}
                style={[styles.chip, {backgroundColor: theme['color-primary-500']}]}>
                <Text category="h9" status="control" bold>
                  {country}
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
                  {country}
                </Text>
                {selected ? (
                  <Icon
                    pack="eva"
                    name="checkmark-circle-2"
                    style={[globalStyle.icon20, {tintColor: theme['color-primary-500']}]}
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
      <Button
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
  search: {
    ...globalStyle.shadow,
    marginBottom: 16,
    backgroundColor: 'background-basic-color-2',
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
