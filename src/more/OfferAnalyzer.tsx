import React, {memo} from 'react';
import {View} from 'react-native';
import {TopNavigation, StyleService, useStyleSheet, useTheme, Input, Icon} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CtaButton from 'components/CtaButton';
import ProLockGate from 'components/ProLockGate';
import {globalStyle} from 'styles/globalStyle';
import {RootStackParamList} from 'navigation/types';
import {AuthContext} from '../../AuthContext';
import * as offerAnalyzerService from 'services/offerAnalyzerService';
import {OfferAnalyzerResult} from 'services/offerAnalyzerService';

// Offer/Salary Analyzer (product request: "See the Salary analyser too"
// [resume.io's /app/offer-analyzer-result]) — a one-shot numeric
// market-rate calculator, deliberately a SEPARATE screen from
// src/practice/SalaryNegotiation.tsx's conversational, round-based
// recruiter-pushback simulator. See
// Saveur-Backend/app/api/offer_analyzer.py's module docstring for the full
// "these are complementary, not redundant" reasoning — this screen's own
// result includes a CTA into Salary Negotiation for practicing the actual
// conversation once you have a number to anchor on.
const ASSESSMENT_COLOR: Record<string, string> = {
  below_market: '#c2554a',
  at_market: '#b5761f',
  above_market: '#1f9c5a',
};

const OfferAnalyzer = memo(() => {
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);
  const {isPro} = React.useContext(AuthContext);

  const [jobTitle, setJobTitle] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [yearsExperience, setYearsExperience] = React.useState('');
  const [offeredSalary, setOfferedSalary] = React.useState('');
  const [benefits, setBenefits] = React.useState('');
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<OfferAnalyzerResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const canAnalyze = jobTitle.trim() && location.trim() && offeredSalary.trim() && !isAnalyzing;

  const onAnalyze = async () => {
    if (!canAnalyze) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const parsedSalary = Number(offeredSalary.replace(/[^0-9.]/g, ''));
      const parsedYears = yearsExperience.trim() ? Number(yearsExperience.replace(/[^0-9.]/g, '')) : undefined;
      const analyzed = await offerAnalyzerService.analyzeOffer({
        jobTitle: jobTitle.trim(),
        location: location.trim(),
        yearsExperience: parsedYears,
        offeredSalary: parsedSalary,
        benefits: benefits.trim(),
      });
      setResult(analyzed);
    } catch (e: any) {
      setError(e?.message ?? t('more:offer_analyzer_failed', {defaultValue: "Couldn't analyze this offer right now. Please try again."}));
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:offer_analyzer_title', {defaultValue: 'Offer & Salary Analyzer'}).toString()}
        description={t('more:offer_analyzer_pro_gate_description', {
          defaultValue: 'Enter a job offer and see a real market-rate range plus a suggested counter number — Offer Analyzer is a Basic feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:offer_analyzer_title', {defaultValue: 'Offer & Salary Analyzer'}).toString()}
        accessoryLeft={() => <NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:offer_analyzer_subtitle', {
            defaultValue: 'Enter your offer details to see a fair-market range and a specific number to counter with.',
          })}
        </Text>

        <Text category="h9" bold mb={6}>{t('more:offer_analyzer_job_title', {defaultValue: 'Job title'})}</Text>
        <Input
          placeholder={t('more:offer_analyzer_job_title_placeholder', {defaultValue: 'e.g. Senior Product Manager'}).toString()}
          value={jobTitle}
          onChangeText={setJobTitle}
          style={styles.input}
          textStyle={styles.inputText}
          size="large"
        />

        <Text category="h9" bold mb={6} mt={16}>{t('more:offer_analyzer_location', {defaultValue: 'Location'})}</Text>
        <Input
          placeholder={t('more:offer_analyzer_location_placeholder', {defaultValue: 'e.g. Austin, TX'}).toString()}
          value={location}
          onChangeText={setLocation}
          style={styles.input}
          textStyle={styles.inputText}
          size="large"
        />

        <Text category="h9" bold mb={6} mt={16}>{t('more:offer_analyzer_years_experience', {defaultValue: 'Years of experience (optional)'})}</Text>
        <Input
          placeholder={t('more:offer_analyzer_years_experience_placeholder', {defaultValue: 'e.g. 4'}).toString()}
          value={yearsExperience}
          onChangeText={setYearsExperience}
          keyboardType="numeric"
          style={styles.input}
          textStyle={styles.inputText}
          size="large"
        />

        <Text category="h9" bold mb={6} mt={16}>{t('more:offer_analyzer_offered_salary', {defaultValue: 'Offered total compensation (USD)'})}</Text>
        <Input
          placeholder={t('more:offer_analyzer_offered_salary_placeholder', {defaultValue: 'e.g. 105000'}).toString()}
          value={offeredSalary}
          onChangeText={setOfferedSalary}
          keyboardType="numeric"
          style={styles.input}
          textStyle={styles.inputText}
          size="large"
        />

        <Text category="h9" bold mb={6} mt={16}>{t('more:offer_analyzer_benefits', {defaultValue: 'Other benefits mentioned (optional)'})}</Text>
        <Input
          placeholder={t('more:offer_analyzer_benefits_placeholder', {defaultValue: 'e.g. equity, sign-on bonus, remote'}).toString()}
          value={benefits}
          onChangeText={setBenefits}
          style={styles.input}
          textStyle={styles.inputText}
          size="large"
          multiline
        />

        {!!error && <Text status="danger" mt={16}>{error}</Text>}

        <CtaButton size="large" style={{marginTop: 24}} onPress={onAnalyze} loading={isAnalyzing} disabled={!canAnalyze}>
          {t('more:offer_analyzer_analyze_button', {defaultValue: 'Analyze my offer'})}
        </CtaButton>

        {!!result && (
          <View style={[styles.resultCard, {borderColor: theme['background-basic-color-4']}]}>
            <Text category="h9" status="placeholder" mb={4}>
              {t('more:offer_analyzer_fair_market_range', {defaultValue: 'Fair market range'})}
            </Text>
            <Text category="h3" bold mb={12}>
              {result.fairMarketRange.low?.toLocaleString() ?? '—'} – {result.fairMarketRange.high?.toLocaleString() ?? '—'} {result.fairMarketRange.currency}
            </Text>

            <View style={[styles.assessmentPill, {backgroundColor: `${ASSESSMENT_COLOR[result.offerAssessment]}1A`}]}>
              <Text category="h10-s" bold style={{color: ASSESSMENT_COLOR[result.offerAssessment]}}>
                {t(`more:offer_analyzer_assessment_${result.offerAssessment}`, {
                  defaultValue: result.offerAssessment === 'below_market' ? 'Below market' : result.offerAssessment === 'above_market' ? 'Above market' : 'At market',
                })}
              </Text>
            </View>

            {result.suggestedCounter != null && (
              <View style={styles.counterRow}>
                <Text category="h9" status="placeholder">{t('more:offer_analyzer_suggested_counter', {defaultValue: 'Suggested counter'})}</Text>
                <Text category="h6" bold>{result.suggestedCounter.toLocaleString()} {result.fairMarketRange.currency}</Text>
              </View>
            )}

            {!!result.rationale && <Text category="h9-s" mt={16}>{result.rationale}</Text>}

            {!!result.negotiationTip && (
              <View style={[styles.tipRow, {backgroundColor: theme['background-basic-color-2']}]}>
                <Icon pack="eva" name="bulb-outline" style={[globalStyle.icon20, {tintColor: theme['color-primary-100']}]} />
                <Text category="h10-s" style={{flex: 1, marginLeft: 8}}>{result.negotiationTip}</Text>
              </View>
            )}

            <CtaButton
              size="large"
              style={{marginTop: 20}}
              onPress={() => navigate('SalaryNegotiation', {role: jobTitle.trim()})}>
              {t('more:offer_analyzer_practice_negotiation', {defaultValue: 'Practice negotiating this offer'})}
            </CtaButton>
          </View>
        )}
      </Content>
    </Container>
  );
});

export default OfferAnalyzer;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  input: {
    ...globalStyle.inputField,
  },
  inputText: {
    ...globalStyle.inputText,
  },
  resultCard: {
    marginTop: 28,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  assessmentPill: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginBottom: 16,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'background-basic-color-3',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
  },
});
