import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import InfoBox from 'components/InfoBox';
import * as companyIntelService from 'services/companyIntelService';
import { CompanyIntel } from 'services/companyIntelService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

// Company Intelligence — product request item: real, web-search-grounded
// pre-interview research plus AI-generated likely questions. See
// services/companyIntelService.ts.
const CompanyIntelligence = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const route = useRoute<RouteProp<RootStackParamList, 'CompanyIntelligence'>>();
  const { isPro } = React.useContext(AuthContext);

  const [company, setCompany] = React.useState(route.params?.company ?? '');
  const [role, setRole] = React.useState(route.params?.role ?? '');
  const [isLoading, setIsLoading] = React.useState(false);
  const [intel, setIntel] = React.useState<CompanyIntel | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onResearch = async () => {
    if (!company.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);
    setIntel(null);
    try {
      const result = await companyIntelService.researchCompany(company.trim(), role.trim());
      setIntel(result);
    } catch {
      setError(t('more:company_research_failed', { defaultValue: "Couldn't research this company right now. Please try again." }));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:company_intelligence', { defaultValue: 'Company Intelligence' })}
        description={t('more:company_intel_pro_gate_description', {
          defaultValue: 'Real, AI-researched company facts and likely interview questions before you walk in — a Pro feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:company_intelligence', { defaultValue: 'Company Intelligence' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {/* Product request: "some features in the app users don't know
            what they are for... supposed to have a small banner card
            explaining what they are... a subtle light blue banner". This
            screen previously had no explanatory copy at all — jumped
            straight to the input fields with only the top nav's title as
            context. */}
        <InfoBox icon="search-outline" variant="info" style={{ marginBottom: 16 }}>
          {t('more:company_intel_description', {
            defaultValue: 'Get instant, AI-researched facts about any company — recent news, culture, and the interview questions you\'re likely to be asked — before you walk in.',
          })}
        </InfoBox>
        <Input
          placeholder={t('more:company_placeholder', { defaultValue: 'e.g. Acme Corp' })}
          value={company}
          onChangeText={setCompany}
          style={[styles.input, { marginBottom: 12 }]}
          textStyle={globalStyle.inputText}
        />
        <Input
          placeholder={t('more:role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
          value={role}
          onChangeText={setRole}
          style={styles.input}
          textStyle={globalStyle.inputText}
        />
        <CtaButton
          style={[globalStyle.shadowBtn, { marginTop: 20 }]}
          disabled={!company.trim() || isLoading}
          onPress={onResearch}
        >
          {isLoading ? () => <Spinner size="small" status="control" /> : t('more:research', { defaultValue: 'Research' })}
        </CtaButton>

        {error ? <Text category="h9-s" status="danger" mt={16} center>{error}</Text> : null}

        {intel ? (
          <View style={{ marginTop: 24 }}>
            <Layout level="2" style={styles.card}>
              <Text category="h7" bold mb={8}>{intel.company}</Text>
              <Text category="h9-s">{intel.overview}</Text>
            </Layout>

            {intel.recentDevelopments.length ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9" bold mb={10}>{t('more:recent_developments', { defaultValue: 'Recent Developments' })}</Text>
                {intel.recentDevelopments.map((d, i) => (
                  <Flex key={i} justify="flex-start" itemsCenter mb={6}>
                    <Icon pack="eva" name="radio-button-on-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                    <Text category="h10" style={{ marginLeft: 8, flex: 1 }}>{d}</Text>
                  </Flex>
                ))}
              </Layout>
            ) : null}

            {intel.cultureNotes ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9" bold mb={6}>{t('more:culture_notes', { defaultValue: 'Culture' })}</Text>
                <Text category="h10" status="placeholder">{intel.cultureNotes}</Text>
              </Layout>
            ) : null}

            {intel.likelyQuestions.length ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9" bold mb={10}>{t('more:likely_questions', { defaultValue: 'Likely Interview Questions' })}</Text>
                {intel.likelyQuestions.map((q, i) => (
                  <Text key={i} category="h10" mb={8}>{i + 1}. {q}</Text>
                ))}
              </Layout>
            ) : null}

            {intel.talkingPoints.length ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9" bold mb={10}>{t('more:talking_points', { defaultValue: 'Talking Points To Bring Up' })}</Text>
                {intel.talkingPoints.map((p, i) => (
                  <Flex key={i} justify="flex-start" itemsCenter mb={6}>
                    <Icon pack="eva" name="bulb-outline" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                    <Text category="h10" style={{ marginLeft: 8, flex: 1 }}>{p}</Text>
                  </Flex>
                ))}
              </Layout>
            ) : null}
          </View>
        ) : null}
      </Content>
    </Container>
  );
});

export default CompanyIntelligence;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { ...globalStyle.inputField },
  card: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 12,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
});
