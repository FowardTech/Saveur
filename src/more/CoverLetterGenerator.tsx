import React, { memo } from 'react';
import { Alert, Share, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Button,
  Input,
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
import * as coverLetterService from 'services/coverLetterService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';

// AI Cover Letter Generator — product request item. Reuses the caller's
// already-stored resume server-side (see services/coverLetterService.ts /
// POST /api/v1/resume/cover-letter) so the only inputs needed here are the
// target company/role — same Pro gate as the resume tailoring flow
// (GenerateResume.tsx), since this is the same "AI writes a job-application
// document from your resume" feature family.
const CoverLetterGenerator = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const route = useRoute<RouteProp<RootStackParamList, 'CoverLetterGenerator'>>();
  const { isPro } = React.useContext(AuthContext);

  const [company, setCompany] = React.useState(route.params?.company ?? '');
  const [role, setRole] = React.useState(route.params?.role ?? '');
  const [hiringManager, setHiringManager] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [letter, setLetter] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onGenerate = async () => {
    if (!company.trim() || !role.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setLetter(null);
    try {
      const result = await coverLetterService.generateCoverLetter({
        company: company.trim(),
        role: role.trim(),
        hiringManager: hiringManager.trim(),
        jdText: route.params?.jdText,
      });
      setLetter(result);
    } catch (e: any) {
      setError(
        e?.response?.data?.detail || e?.response?.data?.message ||
        t('more:cover_letter_generation_failed', { defaultValue: "Couldn't generate a cover letter right now. Please try again." }),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const onShare = () => {
    if (!letter) return;
    Share.share({ message: letter }).catch(() => {});
  };

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:cover_letter_generator', { defaultValue: 'Cover Letter Generator' })}
        description={t('more:cover_letter_pro_gate_description', {
          defaultValue: 'AI writes a tailored cover letter from your resume for any company and role — a Pro feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:cover_letter_generator', { defaultValue: 'Cover Letter Generator' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:cover_letter_generator_description', {
            defaultValue: 'The AI tailors a cover letter using your saved resume — just tell it who you’re applying to.',
          })}
        </Text>

        <Text category="h10" status="placeholder" mb={6}>
          {t('more:company_label', { defaultValue: 'Company' })}
        </Text>
        <Input
          placeholder={t('more:company_placeholder', { defaultValue: 'e.g. Acme Corp' })}
          value={company}
          onChangeText={setCompany}
          style={styles.input}
        />

        <Text category="h10" status="placeholder" mt={16} mb={6}>
          {t('more:role_label', { defaultValue: 'Role' })}
        </Text>
        <Input
          placeholder={t('more:role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
          value={role}
          onChangeText={setRole}
          style={styles.input}
        />

        <Text category="h10" status="placeholder" mt={16} mb={6}>
          {t('more:hiring_manager_label', { defaultValue: 'Hiring manager (optional)' })}
        </Text>
        <Input
          placeholder={t('more:hiring_manager_placeholder', { defaultValue: 'e.g. Jane Smith' })}
          value={hiringManager}
          onChangeText={setHiringManager}
          style={styles.input}
        />

        <Button
          style={[globalStyle.shadowBtn, { marginTop: 24 }]}
          disabled={!company.trim() || !role.trim() || isGenerating}
          onPress={onGenerate}
        >
          {isGenerating
            ? () => <Spinner size="small" status="control" />
            : t('more:generate_cover_letter', { defaultValue: 'Generate Cover Letter' })}
        </Button>

        {error ? (
          <Text category="h9-s" status="danger" mt={16} center>
            {error}
          </Text>
        ) : null}

        {letter ? (
          <View style={styles.letterBox}>
            <Text category="para-m" style={styles.letterText}>{letter}</Text>
            <Flex justify="space-between" mt={16}>
              <Button size="small" appearance="outline" style={globalStyle.flexOne} onPress={onGenerate}>
                {t('more:regenerate', { defaultValue: 'Regenerate' })}
              </Button>
              <View style={{ width: 12 }} />
              <Button size="small" style={globalStyle.flexOne} onPress={onShare}>
                {t('more:share', { defaultValue: 'Share' })}
              </Button>
            </Flex>
          </View>
        ) : null}
      </Content>
    </Container>
  );
});

export default CoverLetterGenerator;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  input: {
    borderRadius: 12,
  },
  letterBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
  },
  letterText: {
    lineHeight: 24,
  },
});
