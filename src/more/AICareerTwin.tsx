import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Icon,
  Input,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import EmptyState from 'components/EmptyState';
import { SkeletonList } from 'components/Skeleton';
import InfoBox from 'components/InfoBox';
import { globalStyle } from 'styles/globalStyle';
import * as aiTwinService from 'services/aiTwinService';
import { AiTwinProfile } from 'services/aiTwinService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

// AI Career Twin — one aggregated profile (headline/summary/skills/
// experience/education) merged server-side from every resume-family row
// already on the account (uploads, and anything built via GenerateResume.
// tsx's AI generator/section editor — see Saveur-Backend's app/api/
// ai_twin.py _profile_payload()), plus free-form Q&A grounded in that
// merged profile. First (and, as of this pass, only) screen wired up to
// aiTwinService.ts — that file existed with a working backend behind it but
// literally no screen referenced it before this. Deliberately no "edit"
// affordance here, same as CareerDna.tsx: the whole point is that it's
// derived from what's already in the app, not a form to fill out.
//
// PRODUCT DECISION: Premium-gated (not Basic) — see AuthContext's
// isPremium/isPremiumTier for the full tier breakdown, mirroring the
// backend's @require_premium on every ai_twin.py route.
const AICareerTwin = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPremium } = React.useContext(AuthContext);

  const [profile, setProfile] = React.useState<AiTwinProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [question, setQuestion] = React.useState('');
  const [isAsking, setIsAsking] = React.useState(false);
  const [askError, setAskError] = React.useState<string | null>(null);
  const [qaHistory, setQaHistory] = React.useState<Array<{ question: string; answer: string }>>([]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setProfile(await aiTwinService.getAiTwin());
    } catch (e: any) {
      setLoadError(
        e?.message ?? t('more:ai_career_twin_load_failed', { defaultValue: 'Could not load your Career Twin.' }),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    // Skip the network call entirely for a non-Premium viewer — the ProLockGate
    // below replaces the whole screen anyway, and calling a 402-gated endpoint
    // just to have it rejected has no upside.
    if (isPremium) load();
  }, [isPremium, load]);

  const onAsk = async () => {
    const q = question.trim();
    if (!q || isAsking) return;
    setIsAsking(true);
    setAskError(null);
    try {
      const answer = await aiTwinService.askAiTwin(q);
      setQaHistory(prev => [...prev, { question: q, answer }]);
      setQuestion('');
    } catch (e: any) {
      setAskError(
        e?.message ?? t('more:ai_career_twin_ask_failed', { defaultValue: "Couldn't get an answer right now. Please try again." }),
      );
    } finally {
      setIsAsking(false);
    }
  };

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:ai_career_twin', { defaultValue: 'AI Career Twin' }).toString()}
        description={t('more:ai_career_twin_premium_gate_description', {
          defaultValue: 'One profile built from everything you’ve already put in the app — resumes, skills, experience — that you can ask anything. A Premium feature.',
        }).toString()}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:ai_career_twin', { defaultValue: 'AI Career Twin' }).toString()}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder contentContainerStyle={styles.content}>
        <InfoBox icon="person-outline" variant="info" style={{ marginBottom: 16 }}>
          {t('more:ai_career_twin_description', {
            defaultValue: 'Your aggregated profile from every resume you’ve built or uploaded — ask it anything about your own background.',
          })}
        </InfoBox>

        {isLoading ? (
          <SkeletonList count={4} style={{ paddingHorizontal: 16 }} />
        ) : loadError ? (
          <EmptyState
            variant="error"
            title={t('common:something_went_wrong', { defaultValue: 'Something went wrong' }).toString()}
            body={loadError}
            actionLabel={t('common:try_again', { defaultValue: 'Try again' }).toString()}
            onAction={load}
          />
        ) : !profile?.hasProfile ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Icon pack="assets" name="aiCareerTwin" style={[globalStyle.icon40, { tintColor: theme['text-hint-color'] }]} />
            <Text category="h7" bold center mt={20}>
              {t('more:ai_career_twin_not_enough_data_title', { defaultValue: 'Your Career Twin is still empty' })}
            </Text>
            <Text category="h9-s" status="placeholder" center mt={8} maxWidth={280}>
              {t('more:ai_career_twin_not_enough_data_body', {
                defaultValue: 'Build or upload a resume first — your Career Twin merges everything you add there into one profile it can answer questions about.',
              })}
            </Text>
          </Flex>
        ) : (
          <>
            <Layout level="2" style={styles.card}>
              {profile.headline ? (
                <Text category="h6" bold mb={6}>{profile.headline}</Text>
              ) : null}
              {profile.summary ? (
                <Text category="h9">{profile.summary}</Text>
              ) : null}
              <Text category="h10" status="placeholder" mt={12}>
                {t('more:ai_career_twin_built_from', {
                  defaultValue: 'Built from {{resumeCount}} resume(s) and {{documentCount}} document(s)',
                  resumeCount: profile.resumeCount,
                  documentCount: profile.documentCount,
                })}
              </Text>
            </Layout>

            {profile.skills.length ? (
              <View style={{ marginBottom: 16 }}>
                <Text category="h9" bold status="placeholder" mb={8}>
                  {t('more:ai_career_twin_skills', { defaultValue: 'Skills' })}
                </Text>
                <Flex justify="flex-start" wrap>
                  {profile.skills.map((skill, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: theme['color-primary-transparent-200'] }]}>
                      <Text category="h10" bold status="link">{skill}</Text>
                    </View>
                  ))}
                </Flex>
              </View>
            ) : null}

            {profile.experience.length ? (
              <Layout level="2" style={styles.card}>
                <Text category="h8" bold mb={10}>
                  {t('more:ai_career_twin_experience', { defaultValue: 'Experience' })}
                </Text>
                {profile.experience.map((exp, i) => (
                  <View key={i} style={i > 0 ? styles.listRow : undefined}>
                    <Text category="h9" bold>
                      {[exp.title, exp.company].filter(Boolean).join(' • ') || t('more:ai_career_twin_untitled_role', { defaultValue: 'Untitled role' })}
                    </Text>
                    {exp.location || exp.start || exp.end ? (
                      <Text category="h10" status="placeholder" mt={2}>
                        {[exp.location, [exp.start, exp.end].filter(Boolean).join(' – ')].filter(Boolean).join(' • ')}
                      </Text>
                    ) : null}
                    {(exp.bullets ?? []).map((b, bi) => (
                      <Text key={bi} category="h9-s" mt={4}>{'• '}{b}</Text>
                    ))}
                  </View>
                ))}
              </Layout>
            ) : null}

            {profile.education.length ? (
              <Layout level="2" style={styles.card}>
                <Text category="h8" bold mb={10}>
                  {t('more:ai_career_twin_education', { defaultValue: 'Education' })}
                </Text>
                {profile.education.map((edu, i) => (
                  <View key={i} style={i > 0 ? styles.listRow : undefined}>
                    <Text category="h9" bold>
                      {[edu.degree, edu.field].filter(Boolean).join(', ') || t('more:ai_career_twin_untitled_education_entry', { defaultValue: 'Untitled entry' })}
                    </Text>
                    {edu.school || edu.start || edu.end ? (
                      <Text category="h10" status="placeholder" mt={2}>
                        {[edu.school, [edu.start, edu.end].filter(Boolean).join(' – ')].filter(Boolean).join(' • ')}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </Layout>
            ) : null}

            <Layout level="2" style={styles.card}>
              <Text category="h8" bold mb={4}>
                {t('more:ai_career_twin_ask_title', { defaultValue: 'Ask your Career Twin' })}
              </Text>
              <Text category="h9-s" status="placeholder" mb={12}>
                {t('more:ai_career_twin_ask_description', {
                  defaultValue: 'e.g. "What’s my strongest skill for a product manager role?"',
                })}
              </Text>
              <Input
                placeholder={t('more:ai_career_twin_ask_placeholder', { defaultValue: 'Ask a question about your background…' }).toString()}
                value={question}
                onChangeText={setQuestion}
                multiline
                textStyle={[globalStyle.inputText, { minHeight: 60, textAlignVertical: 'top' }]}
                style={globalStyle.inputField}
              />
              <CtaButton
                style={{ marginTop: 12 }}
                disabled={!question.trim() || isAsking}
                onPress={onAsk}>
                {isAsking
                  ? <Spinner size="small" status="control" />
                  : t('more:ai_career_twin_ask_cta', { defaultValue: 'Ask' })}
              </CtaButton>

              {askError ? <Text category="h10" status="danger" mt={12}>{askError}</Text> : null}

              {qaHistory.length ? (
                <View style={{ marginTop: 16 }}>
                  {qaHistory.map((qa, i) => (
                    <View key={i} style={i > 0 ? styles.listRow : undefined}>
                      <Text category="h9" bold>{qa.question}</Text>
                      <Text category="h9-s" mt={6}>{qa.answer}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </Layout>
          </>
        )}
      </Content>
    </Container>
  );
});

export default AICareerTwin;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  card: {
    ...globalStyle.card,
    padding: 16,
    marginBottom: 16,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  listRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'background-basic-color-3',
  },
});
