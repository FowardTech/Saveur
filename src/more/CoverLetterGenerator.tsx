import React, { memo } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
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
import {
  downloadDocumentFile,
  saveToAndroidDownloads,
  mimeForFormat,
} from 'services/documentDownloadService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

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
  const [downloadingFormat, setDownloadingFormat] = React.useState<'pdf' | 'docx' | null>(null);

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

  // Was a single "Share" button that did Share.share({message: letter}) —
  // a plain-text share, since there was no real file. Replaced with two
  // explicit "Download as ___" buttons (same pattern as GenerateResume.tsx's
  // onDownload) that render a real PDF/DOCX server-side and hand the OS a
  // real local file — a remote url shared/downloaded directly only ever
  // produces a web-link share on either platform, never an actual file.
  const onDownload = async (format: 'pdf' | 'docx') => {
    if (!letter || downloadingFormat) return;
    setDownloadingFormat(format);
    const filename = `Cover Letter.${format}`;
    try {
      const { url } = await coverLetterService.exportCoverLetter(letter, format);
      if (!url) {
        await Share.share({ message: letter, title: filename });
        return;
      }
      // Goes through documentDownloadService.downloadDocumentFile so a
      // stale/404'd document URL can never again be silently saved/shared
      // as if it were a real PDF/DOCX (see that service for the full
      // explanation) — same fix as GenerateResume.tsx's onDownload.
      const tempPath = await downloadDocumentFile(url, filename);
      if (Platform.OS === 'android') {
        await saveToAndroidDownloads(tempPath, filename, mimeForFormat(format));
        Alert.alert(
          t('more:resume_download_complete_title', { defaultValue: 'Download complete' }),
          t('more:resume_download_complete_message', {
            defaultValue: '{{filename}} was saved to your Downloads folder.',
            filename,
          }),
        );
      } else {
        await Share.share({ url: `file://${tempPath}`, title: filename });
        // See GenerateResume.tsx's onDownload for why this alert exists —
        // same "also saved to Generated Documents" confirmation, since iOS
        // has no system notification for a share-sheet action the way
        // Android's DownloadManager does.
        Alert.alert(
          t('more:resume_download_complete_title', { defaultValue: 'Download complete' }),
          t('more:document_saved_to_app_message', {
            defaultValue: 'This document was also saved to your Generated Documents — you can redownload or rename it anytime.',
          }),
        );
      }
    } catch (e: any) {
      Alert.alert(
        t('more:resume_download_failed_title', { defaultValue: "Couldn't download the file" }),
        e?.message ?? t('more:resume_download_failed_message', { defaultValue: 'Please try again in a moment.' }),
      );
    } finally {
      setDownloadingFormat(null);
    }
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
          textStyle={globalStyle.inputText}
        />

        <Text category="h10" status="placeholder" mt={16} mb={6}>
          {t('more:role_label', { defaultValue: 'Role' })}
        </Text>
        <Input
          placeholder={t('more:role_placeholder', { defaultValue: 'e.g. Senior Product Manager' })}
          value={role}
          onChangeText={setRole}
          style={styles.input}
          textStyle={globalStyle.inputText}
        />

        <Text category="h10" status="placeholder" mt={16} mb={6}>
          {t('more:hiring_manager_label', { defaultValue: 'Hiring manager (optional)' })}
        </Text>
        <Input
          placeholder={t('more:hiring_manager_placeholder', { defaultValue: 'e.g. Jane Smith' })}
          value={hiringManager}
          onChangeText={setHiringManager}
          style={styles.input}
          textStyle={globalStyle.inputText}
        />

        <CtaButton
          style={[globalStyle.shadowBtn, { marginTop: 24 }]}
          disabled={!company.trim() || !role.trim() || isGenerating}
          onPress={onGenerate}
        >
          {isGenerating
            ? () => <Spinner size="small" status="control" />
            : t('more:generate_cover_letter', { defaultValue: 'Generate Cover Letter' })}
        </CtaButton>

        {error ? (
          <Text category="h9-s" status="danger" mt={16} center>
            {error}
          </Text>
        ) : null}

        {letter ? (
          <View style={styles.letterBox}>
            <Text category="para-m" style={styles.letterText}>{letter}</Text>
            <Button
              size="small"
              appearance="outline"
              style={{ marginTop: 16 }}
              disabled={!!downloadingFormat}
              onPress={onGenerate}
            >
              {t('more:regenerate', { defaultValue: 'Regenerate' })}
            </Button>
            <Flex justify="space-between" mt={12}>
              <Button
                size="small"
                style={globalStyle.flexOne}
                disabled={!!downloadingFormat}
                accessoryLeft={downloadingFormat === 'pdf' ? () => <Spinner size="small" status="control" /> : undefined}
                onPress={() => onDownload('pdf')}
              >
                {downloadingFormat === 'pdf'
                  ? t('more:resume_preparing', { defaultValue: 'Preparing…' })
                  : t('more:download_pdf', { defaultValue: 'Download PDF' })}
              </Button>
              <View style={{ width: 12 }} />
              <Button
                size="small"
                appearance="outline"
                style={globalStyle.flexOne}
                disabled={!!downloadingFormat}
                accessoryLeft={downloadingFormat === 'docx' ? () => <Spinner size="small" status="basic" /> : undefined}
                onPress={() => onDownload('docx')}
              >
                {downloadingFormat === 'docx'
                  ? t('more:resume_preparing', { defaultValue: 'Preparing…' })
                  : t('more:download_docx', { defaultValue: 'Download DOCX' })}
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
    ...globalStyle.inputField,
  },
  letterBox: {
    ...globalStyle.card,
    marginTop: 24,
    padding: 16,
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android (was
    // 'transparent') — this renders on a plain View (no `level` prop), so
    // the fill has to live here.
    backgroundColor: 'background-basic-color-2',
  },
  letterText: {
    lineHeight: 24,
  },
});
