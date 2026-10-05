import React, { memo } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Input,
  Layout,
  Spinner,
} from '@ui-kitten/components';
import { RouteProp, useRoute, NavigationProp, useNavigation } from '@react-navigation/native';
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
import CtaButton from 'components/CtaButton';
import CopyButton from 'components/CopyButton';
import DownloadFormatButtons from 'components/DownloadFormatButtons';

// AI Cover Letter Generator — product request item. Reuses the caller's
// already-stored resume server-side (see services/coverLetterService.ts /
// POST /api/v1/resume/cover-letter) so the only inputs needed here are the
// target company/role.
//
// BUG FIX (task #53 investigation): this screen used to be a full blanket
// `if (!isPro) return <ProLockGate/>` (like GenerateResume.tsx's sibling
// flow), but the backend migrated /resume/cover-letter to the same
// free-plan combined pool as generate/ats-score/rewrite-bullet back in
// task #28 (entitlements_service.py's FREE_RESUME_TOOL_ACTIONS_PER_MONTH)
// — web's app/resume/cover-letter/page.tsx was updated for that, mobile
// never was. Now mirrors that page: real form for everyone, reactive 402
// resume_tool_limit_reached handling + a free-actions-remaining banner.
const CoverLetterGenerator = memo(() => {
  const styles = useStyleSheet(themedStyles);
  const theme = useTheme();
  const { t } = useTranslation(['more', 'common']);
  const route = useRoute<RouteProp<RootStackParamList, 'CoverLetterGenerator'>>();
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { isPro, subscription, refreshSubscription } = React.useContext(AuthContext);

  const [company, setCompany] = React.useState(route.params?.company ?? '');
  const [role, setRole] = React.useState(route.params?.role ?? '');
  const [hiringManager, setHiringManager] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [letter, setLetter] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = React.useState<'pdf' | 'docx' | null>(null);
  const [limitReached, setLimitReached] = React.useState(false);
  const [limitMessage, setLimitMessage] = React.useState<string | null>(null);

  const onGenerate = async () => {
    if (!company.trim() || !role.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setLetter(null);
    setLimitReached(false);
    try {
      const result = await coverLetterService.generateCoverLetter({
        company: company.trim(),
        role: role.trim(),
        hiringManager: hiringManager.trim(),
        jdText: route.params?.jdText,
      });
      setLetter(result);
      void refreshSubscription();
    } catch (e: any) {
      // Every services/*.ts call goes through apiClient.ts's response
      // interceptor, which normalizes ANY failure (network/4xx/5xx) into
      // {status, error, message, code} -- there is no `e.response` on that
      // shape (that was the raw pre-interceptor axios error), so the old
      // `e?.response?.data?.detail` check here was always dead code and
      // this always fell through to the generic message. Fixed to read the
      // actual normalized fields, and to special-case the free-plan cap.
      if (e?.status === 402 && e?.error === 'resume_tool_limit_reached') {
        setLimitReached(true);
        setLimitMessage(e?.message ?? null);
      } else {
        setError(
          e?.message ||
          t('more:cover_letter_generation_failed', { defaultValue: "Couldn't generate a cover letter right now. Please try again." }),
        );
      }
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

        {/* Free-plan usage banner -- same shared pool as ResumeBuilder.tsx
            (generate/ats-score/rewrite-bullet/cover-letter all count
            against the same 2/month allowance). */}
        {!isPro && subscription?.resumeToolActionsLimit != null ? (
          <Layout level="2" style={styles.usageBanner}>
            <Icon pack="eva" name="flash-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
            {(() => {
              const remaining = Math.max(0, subscription.resumeToolActionsLimit! - (subscription.resumeToolActionsUsed ?? 0));
              return (
                <Text category="h9-s" bold status={remaining > 0 ? 'basic' : 'danger'} ml={10} style={globalStyle.flexOne}>
                  {remaining > 0
                    ? t('more:resume_free_actions_remaining', {
                        defaultValue: '{{count}} free resume tool actions left this month',
                        count: remaining,
                      })
                    : t('more:resume_free_actions_used_up', { defaultValue: "You've used all your free resume tool actions this month" })}
                </Text>
              );
            })()}
            <Text category="h10" status="link" bold onPress={() => navigate('Subscription')}>
              {t('more:upgrade', { defaultValue: 'Upgrade' })}
            </Text>
          </Layout>
        ) : null}

        {limitReached ? (
          <Layout level="2" style={styles.limitCard}>
            <View style={[styles.limitIconWrap, { backgroundColor: theme['color-primary-transparent-200'] }]}>
              <Icon pack="eva" name="lock-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
            </View>
            <Text category="h8" bold mt={10}>
              {t('more:resume_limit_reached_title', { defaultValue: "You've used your free resume tool actions this month" })}
            </Text>
            <Text category="h9-s" status="placeholder" mt={4}>
              {limitMessage ?? t('more:resume_limit_reached_subtitle', { defaultValue: 'Upgrade to Saveur Basic or above for unlimited access.' })}
            </Text>
            <Text category="h9" status="link" bold mt={10} onPress={() => navigate('Subscription')}>
              {t('more:upgrade', { defaultValue: 'Upgrade' })}
            </Text>
          </Layout>
        ) : null}

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
          disabled={!company.trim() || !role.trim() || isGenerating || limitReached}
          onPress={onGenerate}
        >
          {isGenerating
            ? () => <Spinner size="small" status="basic" />
            : t('more:generate_cover_letter', { defaultValue: 'Generate Cover Letter' })}
        </CtaButton>

        {error ? (
          <Text category="h9-s" status="danger" mt={16} center>
            {error}
          </Text>
        ) : null}

        {letter ? (
          <View style={styles.letterBox}>
            {/* Plain-text copy alongside the PDF/DOCX downloads below —
                users often want to paste the letter straight into an email
                or an application portal's text field rather than attach a
                file. */}
            <Flex justify="flex-end" mb={8}>
              <CopyButton text={letter} label={t('common:copy', { defaultValue: 'Copy' })} />
            </Flex>
            {/* Product request: "Users should be able to... edit the
                content of the... cover letter generated in the JD analyzer
                screen... and cover letter generated in the resume builder
                screen." This screen is the one shared cover-letter flow
                both entry points funnel through (see this file's own top
                comment), so making the letter editable here covers both at
                once. Was a read-only <Text> — swapped for a multiline
                <Input> bound to the same `letter` state, so onDownload/
                exportCoverLetter below already send whatever the user
                edited, no separate save step needed. No drag/reorder here
                (unlike GenerateResume.tsx's section lists) — a cover
                letter is prose, not a reorderable list of entries. */}
            <Input
              multiline
              value={letter}
              onChangeText={setLetter}
              style={[globalStyle.inputField, styles.letterInput]}
              textStyle={[globalStyle.inputText, styles.letterInputText]}
            />
            <Button
              size="small"
              appearance="outline"
              style={{ marginTop: 16 }}
              disabled={!!downloadingFormat}
              onPress={onGenerate}
            >
              {t('more:regenerate', { defaultValue: 'Regenerate' })}
            </Button>
            <DownloadFormatButtons downloadingFormat={downloadingFormat} onDownload={onDownload} />
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
  // Free-plan resume-tool usage banner / limit-reached card (task #53) --
  // same treatment as ResumeBuilder.tsx's own usageBanner/limitCard.
  usageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  limitCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  limitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
  // See the JSX comment above where these are used, and JDAnalyzer.tsx's
  // jdInput/jdText comment for why the real min-height has to live on
  // `textStyle` (applied directly to the native TextInput) rather than
  // `style` (routes to an outer wrapper UI Kitten's Input doesn't visibly
  // size around this content the same way).
  letterInput: {},
  letterInputText: {
    minHeight: 320,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
});
