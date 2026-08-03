import React, { memo } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { StyleService, useStyleSheet, useTheme, Icon } from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import Text from 'components/Text';
import Flex from 'components/Flex';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as configService from 'services/configService';

// Personalization (product request item) — Career DNA and the Dream
// Company Dashboard both otherwise only live inside "More", which buries
// them. Per explicit follow-up ("Want career DNA and Dream company
// dashboard to be in one card in the homescreen instead of being a
// button"), these two live here as two rows inside ONE card rather than as
// two separate nav-row pills (see HomeSrc.tsx's own comment history for the
// pill version this replaced). Self-contained like DailyChallengeCard: owns
// its own feature-flag checks and navigation, so HomeSrc.tsx just renders
// <PersonalizationCard /> and never has to know its internals. Renders null
// if BOTH features are off; renders just the one row if only one is on.
const PersonalizationCard = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'more']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();

  const careerDnaOn = configService.isFeatureEnabled('career_dna');
  const dreamCompaniesOn = configService.isFeatureEnabled('dream_company_dashboard');

  if (!careerDnaOn && !dreamCompaniesOn) return null;

  return (
    <View style={styles.card}>
      <Text category="h9" bold mb={2}>
        {t('home:personalization_card_title', { defaultValue: 'Know Yourself Better' })}
      </Text>
      <Text category="h10" status="placeholder" mb={12}>
        {t('home:personalization_card_subtitle', {
          defaultValue: 'The app gets to know you a little more every week.',
        })}
      </Text>

      {careerDnaOn ? (
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigate('CareerDna')} style={styles.row}>
          <View style={[styles.iconCircle, { backgroundColor: theme['color-danger-transparent-200'] }]}>
            <Icon pack="eva" name="activity-outline" style={[globalStyle.icon18, { tintColor: theme['color-danger-500'] }]} />
          </View>
          <View style={globalStyle.flexOne}>
            <Text category="h9-s" bold>{t('more:career_dna', { defaultValue: 'Career DNA' })}</Text>
            <Text category="h10" status="placeholder" numberOfLines={1}>
              {t('home:career_dna_row_subtitle', { defaultValue: 'Your AI-built personality & work-style profile' })}
            </Text>
          </View>
          <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon18, { tintColor: theme['text-hint-color'] }]} />
        </TouchableOpacity>
      ) : null}

      {careerDnaOn && dreamCompaniesOn ? <View style={styles.divider} /> : null}

      {dreamCompaniesOn ? (
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigate('DreamCompanies')} style={styles.row}>
          <View style={[styles.iconCircle, { backgroundColor: theme['color-primary-transparent-200'] }]}>
            <Icon pack="eva" name="search-outline" style={[globalStyle.icon18, { tintColor: theme['color-primary-500'] }]} />
          </View>
          <View style={globalStyle.flexOne}>
            <Text category="h9-s" bold>{t('more:dream_companies', { defaultValue: 'Dream Company Dashboard' })}</Text>
            <Text category="h10" status="placeholder" numberOfLines={1}>
              {t('home:dream_companies_row_subtitle', { defaultValue: 'Track the companies you want to work for' })}
            </Text>
          </View>
          <Icon pack="eva" name="arrow-forward-outline" style={[globalStyle.icon18, { tintColor: theme['text-hint-color'] }]} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

export default PersonalizationCard;

const themedStyles = StyleService.create({
  card: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    backgroundColor: 'background-basic-color-2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  divider: {
    height: 1,
    backgroundColor: 'background-basic-color-3',
    marginVertical: 4,
  },
});
