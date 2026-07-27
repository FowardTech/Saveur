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
import { globalStyle } from 'styles/globalStyle';
import * as linkedinOptimizerService from 'services/linkedinOptimizerService';
import { OptimizationResult } from 'services/linkedinOptimizerService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';

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
    } catch {
      setError(t('more:linkedin_optimize_failed', { defaultValue: "Couldn't analyze your profile right now. Please try again." }));
    } finally {
      setIsLoading(false);
    }
  };

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

        <Text category="h10" status="placeholder" mb={6}>{t('more:linkedin_headline_label', { defaultValue: 'Headline' })}</Text>
        <Input value={headline} onChangeText={setHeadline} multiline style={[styles.input, { marginBottom: 16 }]} />

        <Text category="h10" status="placeholder" mb={6}>{t('more:linkedin_about_label', { defaultValue: 'About section' })}</Text>
        <Input value={about} onChangeText={setAbout} multiline textStyle={{ minHeight: 80 }} style={[styles.input, { marginBottom: 16 }]} />

        <Text category="h10" status="placeholder" mb={6}>
          {t('more:linkedin_bullets_label', { defaultValue: 'Experience bullet points (one per line)' })}
        </Text>
        <Input value={bulletsText} onChangeText={setBulletsText} multiline textStyle={{ minHeight: 80 }} style={styles.input} />

        <Button
          style={[globalStyle.shadowBtn, { marginTop: 24 }]}
          disabled={isLoading || (!headline.trim() && !about.trim() && !bulletsText.trim())}
          onPress={onOptimize}
        >
          {isLoading ? () => <Spinner size="small" status="control" /> : t('more:optimize', { defaultValue: 'Optimize' })}
        </Button>

        {error ? <Text category="h9-s" status="danger" mt={16} center>{error}</Text> : null}

        {result ? (
          <View style={{ marginTop: 24 }}>
            {result.profileStrengthScore != null ? (
              <Layout level="2" style={[styles.card, { alignItems: 'center' }]}>
                <Text category="h3" bold>{result.profileStrengthScore}%</Text>
                <Text category="h10" status="placeholder">{t('more:current_profile_strength', { defaultValue: 'Current profile strength' })}</Text>
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
  input: { borderRadius: 12 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
});
