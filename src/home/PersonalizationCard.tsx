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
// them. These used to render as two rows inside ONE shared card (per an
// earlier follow-up), then split back into two independent cards per a
// later explicit request ("Career DNA and Dream company Dashboard should
// be different cards") — see HomeSrc.tsx's own comment history for the
// full back-and-forth. Self-contained like DailyChallengeCard: owns its
// own feature-flag checks and navigation, so HomeSrc.tsx just renders
// <PersonalizationCard /> and never has to know its internals. Renders
// null if BOTH features are off; renders just the one card if only one is
// on.
const PersonalizationCard = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['home', 'more']);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();

  const careerDnaOn = configService.isFeatureEnabled('career_dna');
  const dreamCompaniesOn = configService.isFeatureEnabled('dream_company_dashboard');

  if (!careerDnaOn && !dreamCompaniesOn) return null;

  return (
    <View>
      <Text category="h9" bold mb={2} mt={24}>
        {t('home:personalization_card_title', { defaultValue: 'Know Yourself Better' })}
      </Text>
      <Text category="h10" status="placeholder" mb={12}>
        {t('home:personalization_card_subtitle', {
          defaultValue: 'The app gets to know you a little more every week.',
        })}
      </Text>

      {careerDnaOn ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigate('CareerDna')}
          style={[styles.card, styles.row, dreamCompaniesOn && styles.cardSpacing]}>
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

      {dreamCompaniesOn ? (
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigate('DreamCompanies')} style={[styles.card, styles.row]}>
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
  // Product request: "Career DNA and Dream company Dashboard should be
  // different cards" — each row now carries its own full card treatment
  // (radius/shadow from globalStyle.card, own white fill) instead of both
  // sharing one outer card with an inner divider.
  card: {
    ...globalStyle.card,
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  cardSpacing: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
});
