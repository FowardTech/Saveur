import React, { memo } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  Button,
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

// Product request item 1 — JD Analyzer's "Generate Cover Letter" card used
// to just forward the pasted JD text to CoverLetterGenerator.tsx, which
// then made the user manually type the company/role/hiring manager before
// anything happened: "Since the JD is already pasted it should just
// generate the cover letter." This screen skips that form entirely — it
// generates immediately on mount from the JD text alone, letting the
// backend (app/api/resume_gen.py's generate_cover_letter) read the
// company/name/role straight out of the JD text and write the letter
// against the caller's own resume (the primary stored resume — see that
// endpoint's docstring on resume_render_service.get_primary_resume — which
// becomes whichever resume the user most recently tailored/downloaded via
// GenerateResume.tsx for this or any job, per that screen's own "save on
// download" flow).
//
// Deliberately a SEPARATE screen from CoverLetterGenerator.tsx rather than
// a conditional inside it — that screen is explicitly the general-purpose,
// "type any company/role and get a letter" entry point reachable from
// ResumeBuilder, and stays completely untouched by this feature.
const JDCoverLetterGenerator = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const route = useRoute<RouteProp<RootStackParamList, 'JDCoverLetterGenerator'>>();
  const { isPro } = React.useContext(AuthContext);

  const [isGenerating, setIsGenerating] = React.useState(true);
  const [letter, setLetter] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = React.useState<'pdf' | 'docx' | null>(null);

  const onGenerate = React.useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await coverLetterService.generateCoverLetter({
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
  }, [route.params?.jdText, t]);

  React.useEffect(() => {
    onGenerate();
    // Only auto-generate on mount — "Regenerate" below re-runs the same
    // call explicitly, same pattern as GenerateResume.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        title={t('more:jd_cover_letter_title', { defaultValue: 'Cover Letter' })}
        description={t('more:cover_letter_pro_gate_description', {
          defaultValue: 'AI writes a tailored cover letter from your resume for any company and role — a Basic feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:jd_cover_letter_title', { defaultValue: 'Cover Letter' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {isGenerating ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 60 }}>
            <Spinner size="large" />
            <Text category="h9-s" status="placeholder" mt={12} center>
              {t('more:jd_cover_letter_generating', { defaultValue: 'Writing your cover letter for this job…' })}
            </Text>
          </Flex>
        ) : error ? (
          <Flex vertical itemsCenter justify="center" style={{ paddingVertical: 40 }}>
            <Text category="h9-s" status="danger" center mb={16}>
              {error}
            </Text>
            <Text category="h9" status="link" bold onPress={onGenerate}>
              {t('common:try_again', { defaultValue: 'Try again' })}
            </Text>
          </Flex>
        ) : letter ? (
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

export default JDCoverLetterGenerator;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  letterBox: {
    ...globalStyle.card,
    marginTop: 8,
    padding: 16,
    backgroundColor: 'background-basic-color-2',
  },
  letterText: {
    lineHeight: 24,
  },
});
