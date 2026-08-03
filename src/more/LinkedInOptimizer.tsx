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
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import CircularProgress from 'components/CircularProgress';
import { globalStyle } from 'styles/globalStyle';
import * as linkedinOptimizerService from 'services/linkedinOptimizerService';
import { OptimizationResult, OptimizationHistoryEntry } from 'services/linkedinOptimizerService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import dayjs from 'utils/dayjs';
import CtaButton from 'components/CtaButton';

// AI LinkedIn Optimizer — product request item, Pro Premium feature. Paste
// your current headline/about/bullets, get AI-rewritten versions + feedback.
// See services/linkedinOptimizerService.ts for why this is paste-based
// rather than reading a connected LinkedIn profile automatically.
const LinkedInOptimizer = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPremium, profile } = React.useContext(AuthContext);

  const [headline, setHeadline] = React.useState('');
  const [about, setAbout] = React.useState('');
  const [bulletsText, setBulletsText] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<OptimizationResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Score history (product request item: "expand LinkedIn Optimizer" —
  // every past run used to be lost the moment you navigated away, so there
  // was no way to see whether your profile was actually improving). Loaded
  // once on mount, then refreshed after each successful optimize() so a new
  // run's score shows up immediately without needing to leave and re-enter
  // the screen. Best-effort/silent on failure — a history-list hiccup
  // shouldn't block the actual optimize flow this screen exists for.
  const [history, setHistory] = React.useState<OptimizationHistoryEntry[]>([]);
  const loadHistory = React.useCallback(() => {
    linkedinOptimizerService.getHistory().then(setHistory).catch(() => {});
  }, []);
  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onOptimize = async () => {
    const bullets = bulletsText.split('\n').map(b => b.trim()).filter(Boolean);
    if (!headline.trim() && !about.trim() && bullets.length === 0) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await linkedinOptimizerService.optimizeProfile({
        headline: headline.trim(),
        about: about.trim(),
        experienceBullets: bullets,
        targetRole: profile?.desiredRoles?.[0],
      });
      setResult(res);
      loadHistory();
    } catch {
      setError(t('more:linkedin_optimize_failed', { defaultValue: "Couldn't analyze your profile right now. Please try again." }));
    } finally {
      setIsLoading(false);
    }
  };

  // Previous run's score (the one right before whatever's currently
  // showing in `result`, i.e. history[1] once a fresh run has been
  // prepended by loadHistory) — lets the strength card show a real "+N
  // since last time" delta instead of just a bare number.
  const previousScore = history.length > 1 ? history[1].profileStrengthScore : null;

  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:linkedin_optimizer', { defaultValue: 'LinkedIn Optimizer' })}
        description={t('more:linkedin_optimizer_pro_gate_description', {
          defaultValue: 'AI rewrites your LinkedIn headline, about section, and bullet points to stand out to recruiters — a Pro Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:linkedin_optimizer', { defaultValue: 'LinkedIn Optimizer' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:linkedin_optimizer_description', {
            defaultValue: "Paste any part of your current LinkedIn profile below — the AI will rewrite what you give it and explain why.",
          })}
        </Text>

        {history.length > 0 ? (
          <Layout level="2" style={[styles.card, { marginBottom: 20 }]}>
            <Text category="h9" bold mb={10}>
              {t('more:linkedin_score_history', { defaultValue: 'Score history' })}
            </Text>
            {history.slice(0, 5).map((h, i) => (
              <Flex key={h.id} justify="space-between" itemsCenter mb={i < 4 ? 8 : 0}>
                <Text category="h10" status="placeholder">
                  {h.createdAt ? dayjs(h.createdAt).format('MMM D, YYYY') : ''}
                  {h.targetRole ? ` · ${h.targetRole}` : ''}
                </Text>
                <Text category="h9" bold>
                  {h.profileStrengthScore != null ? `${h.profileStrengthScore}%` : '—'}
                </Text>
              </Flex>
            ))}
          </Layout>
        ) : null}

        <Text category="h10" status="placeholder" mb={6}>{t('more:linkedin_headline_label', { defaultValue: 'Headline' })}</Text>
        <Input value={headline} onChangeText={setHeadline} multiline textStyle={globalStyle.inputText} style={[styles.input, { marginBottom: 16 }]} />

        <Text category="h10" status="placeholder" mb={6}>{t('more:linkedin_about_label', { defaultValue: 'About section' })}</Text>
        <Input value={about} onChangeText={setAbout} multiline textStyle={[globalStyle.inputText, { minHeight: 80 }]} style={[styles.input, { marginBottom: 16 }]} />

        <Text category="h10" status="placeholder" mb={6}>
          {t('more:linkedin_bullets_label', { defaultValue: 'Experience bullet points (one per line)' })}
        </Text>
        <Input value={bulletsText} onChangeText={setBulletsText} multiline textStyle={[globalStyle.inputText, { minHeight: 80 }]} style={styles.input} />

        <CtaButton
          style={[globalStyle.shadowBtn, { marginTop: 24 }]}
          disabled={isLoading || (!headline.trim() && !about.trim() && !bulletsText.trim())}
          onPress={onOptimize}
        >
          {isLoading ? () => <Spinner size="small" status="control" /> : t('more:optimize', { defaultValue: 'Optimize' })}
        </CtaButton>

        {error ? <Text category="h9-s" status="danger" mt={16} center>{error}</Text> : null}

        {result ? (
          <View style={{ marginTop: 24 }}>
            {result.profileStrengthScore != null ? (
              <Layout level="2" style={[styles.card, { alignItems: 'center' }]}>
                {/* Redesign v2 (full reskin) — was a plain "{score}%" text,
                    the one profile-quality score in this app not already
                    shown as a ring (ResumeBuilder's ATS Score, JDAnalyzer's
                    Match Score, InterviewFeedback's Overall Score all are —
                    see components/CircleSlider.tsx). Same brand-blue
                    gradient as the other "no threshold semantics" rings. */}
                <CircularProgress
                  progress={result.profileStrengthScore}
                  size={88}
                  strokeWidth={8}
                  trackColor={theme['background-basic-color-3']}
                  gradientFrom="#059669"
                  gradientTo="#047857">
                  <Text category="h5" bold>{result.profileStrengthScore}%</Text>
                </CircularProgress>
                <Text category="h10" status="placeholder" mt={8}>{t('more:current_profile_strength', { defaultValue: 'Current profile strength' })}</Text>
                {previousScore != null ? (
                  <Text
                    category="h10"
                    status={result.profileStrengthScore >= previousScore ? 'success' : 'warning'}
                    mt={4}
                  >
                    {result.profileStrengthScore >= previousScore
                      ? t('more:linkedin_score_up', { defaultValue: '+{{delta}} since last time', delta: result.profileStrengthScore - previousScore })
                      : t('more:linkedin_score_down', { defaultValue: '{{delta}} since last time', delta: result.profileStrengthScore - previousScore })}
                  </Text>
                ) : null}
              </Layout>
            ) : null}

            {result.overallFeedback ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9-s">{result.overallFeedback}</Text>
              </Layout>
            ) : null}

            {result.headline ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9" bold mb={6}>{t('more:linkedin_headline_label', { defaultValue: 'Headline' })}</Text>
                <Text category="h9-s" mb={8}>{result.headline.suggestion}</Text>
                <Text category="h10" status="placeholder">{result.headline.feedback}</Text>
              </Layout>
            ) : null}

            {result.about ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9" bold mb={6}>{t('more:linkedin_about_label', { defaultValue: 'About section' })}</Text>
                <Text category="h9-s" mb={8}>{result.about.suggestion}</Text>
                <Text category="h10" status="placeholder">{result.about.feedback}</Text>
              </Layout>
            ) : null}

            {result.experienceBullets.length ? (
              <Layout level="2" style={styles.card}>
                <Text category="h9" bold mb={10}>{t('more:linkedin_bullets_label_short', { defaultValue: 'Bullet points' })}</Text>
                {result.experienceBullets.map((b, i) => (
                  <View key={i} style={{ marginBottom: 12 }}>
                    <Text category="h10" status="placeholder" style={{ textDecorationLine: 'line-through' }}>{b.original}</Text>
                    <Text category="h9-s" mt={2}>{b.suggestion}</Text>
                  </View>
                ))}
              </Layout>
            ) : null}
          </View>
        ) : null}
      </Content>
    </Container>
  );
});

export default LinkedInOptimizer;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { ...globalStyle.inputField },
  card: {
    ...globalStyle.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill on Android — dropped the 'transparent' override
    // so this Layout's own `level="2"` background shows through instead.
  },
});
