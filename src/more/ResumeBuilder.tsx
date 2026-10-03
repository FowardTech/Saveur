import React, { memo } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Layout,
  Input,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { pick, isErrorWithCode, errorCodes, types as documentTypes } from '@react-native-documents/picker';

import Text from 'components/Text';
import SectionTitle from 'components/SectionTitle';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import ProgressCard from 'src/find/Component/ProgressCard';
import DocumentPickerModal from 'components/DocumentPickerModal';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { renderCenteredLabel } from 'utils/buttonLabel';
import * as resumeService from 'services/resumeService';
import { ImportedFileInfo, ResumeImportSourceKey, RewriteBulletResult } from 'services/resumeService';
import { DocumentRecord } from 'services/documentsService';
import { AuthContext } from '../../AuthContext';
import CtaButton from 'components/CtaButton';
import { accentColorForKey } from 'utils/accentPalette';

// BUG FIX (product report: "resume builder screen — some content still in
// English regardless of language"): these titles were plain hardcoded
// English strings rendered directly at {opt.title} below with no t() call
// at all, so they never translated no matter what language was selected.
// Now a translation key + English fallback per option, resolved with t()
// at render time instead of baked into this const. LinkedIn is a proper
// noun/brand name, kept as-is like other screens do for brand names.
const IMPORT_OPTIONS: Array<{ key: ResumeImportSourceKey; titleKey: string; titleDefault: string; icon: string }> = [
  { key: 'resume', titleKey: 'more:import_option_resume', titleDefault: 'Resume', icon: 'myPost' },
  { key: 'linkedin', titleKey: 'more:import_option_linkedin', titleDefault: 'LinkedIn', icon: 'searchHistory' },
  { key: 'portfolio', titleKey: 'more:import_option_portfolio', titleDefault: 'Portfolio', icon: 'photoLibrary' },
  { key: 'certificates', titleKey: 'more:import_option_certificates', titleDefault: 'Certificates', icon: 'bgCheck' },
  { key: 'transcript', titleKey: 'more:import_option_transcript', titleDefault: 'Transcript', icon: 'term' },
];

// Real device file access — each "import" option below opens the native
// document picker (@react-native-documents/picker) instead of simulating an
// upload, so users pick an actual file from their phone/iCloud/Drive/etc.
// See services/resumeService.ts for what happens to the picked file
// afterward — it's uploaded as multipart/form-data to POST /resume/upload.
async function pickDocument(fallbackName: string): Promise<ImportedFileInfo | null> {
  try {
    const [result] = await pick({
      type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.plainText, documentTypes.images],
    });
    return {
      uri: result.uri,
      name: result.name ?? fallbackName,
      sizeBytes: result.size,
      mimeType: result.type,
    };
  } catch (err) {
    if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
      return null;
    }
    throw err;
  }
}

// Resume hub: import sources + an ATS score. Imports/analysis are backed by
// services/resumeService.ts, which talks to the real backend (upload,
// ats-score, rewrite-bullet) with an AsyncStorage offline-read cache for the
// imported-sources badges.
const ResumeBuilder = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { profile, isPro, subscription, refreshSubscription } = React.useContext(AuthContext);

  const [imported, setImported] = React.useState<Record<string, ImportedFileInfo>>({});
  const [importingKey, setImportingKey] = React.useState<ResumeImportSourceKey | null>(null);
  const [analyzed, setAnalyzed] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [atsScore, setAtsScore] = React.useState(0);
  const [atsTips, setAtsTips] = React.useState<string[]>([]);

  const [bulletText, setBulletText] = React.useState('');
  const [isRewriting, setIsRewriting] = React.useState(false);
  const [rewriteResult, setRewriteResult] = React.useState<RewriteBulletResult | null>(null);

  // BUG FIX (product report: "I hope Its written in the resume builder
  // (Web and mobile) the amount of usage remaining for the month so that
  // the user can know that the usage of the features are limited"):
  // investigating this surfaced that this screen was still a full blanket
  // `if (!isPro) return <ProLockGate/>` (see below, now removed) even
  // though the backend migrated generate/cover_letter/ats_score/
  // rewrite_bullet to a shared free-plan pool of 2 actions/month back in
  // task #28 (entitlements_service.py's FREE_RESUME_TOOL_ACTIONS_PER_MONTH)
  // — web's own app/resume/builder/page.tsx already got that treatment,
  // mobile never did. `limitReached`/`limitMessage` mirror that web
  // page's 402 resume_tool_limit_reached handling exactly.
  const [limitReached, setLimitReached] = React.useState(false);
  const [limitMessage, setLimitMessage] = React.useState<string | null>(null);

  // Which import slot (Resume/LinkedIn/Portfolio/Certificates/Transcript)
  // the "choose from My Documents" modal is currently open for — null means
  // closed. Set by onImport below instead of jumping straight to the device
  // picker, per user request: give a choice between the device and
  // documents already uploaded elsewhere in the app.
  const [documentPickerFor, setDocumentPickerFor] = React.useState<ResumeImportSourceKey | null>(null);

  React.useEffect(() => {
    resumeService.getImportedSources().then(setImported).catch(() => {
      // getImportedSources already falls back to its offline cache on
      // failure and resolves rather than rejecting, but guard anyway so a
      // truly unexpected error doesn't surface as an unhandled rejection on
      // mount.
    });
  }, []);

  const runImport = React.useCallback(
    async (key: ResumeImportSourceKey, file: ImportedFileInfo) => {
      setImportingKey(key);
      try {
        await resumeService.importSource(key, file);
        setImported(prev => ({ ...prev, [key]: file }));
      } catch (e: any) {
        Alert.alert(
          t('more:upload_failed', { defaultValue: 'Upload failed' }),
          e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
        );
      } finally {
        setImportingKey(null);
      }
    },
    [t],
  );

  // Was: straight to the device file picker, every time. Now offers a
  // choice — device file, or something already sitting in My Documents
  // (resume/portfolio/certificate files uploaded via Chat attachments or the
  // My Documents screen itself) — per explicit user request.
  const onImport = (key: ResumeImportSourceKey) => {
    Alert.alert(
      t('more:import_from', { defaultValue: 'Import from' }),
      undefined,
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }).toString(), style: 'cancel' },
        {
          text: t('more:choose_from_my_documents', { defaultValue: 'Choose from My Documents' }).toString(),
          onPress: () => setDocumentPickerFor(key),
        },
        {
          text: t('more:choose_from_device', { defaultValue: 'Choose from Device' }).toString(),
          onPress: async () => {
            const file = await pickDocument(t('more:selected_file_fallback_name', { defaultValue: 'Selected file' }).toString());
            if (!file) return; // user canceled the native picker
            runImport(key, file);
          },
        },
      ],
    );
  };

  const onPickFromMyDocuments = (doc: DocumentRecord) => {
    const key = documentPickerFor;
    setDocumentPickerFor(null);
    if (!key) return;
    // Re-runs the file through the same POST /resume/upload multipart flow
    // as a device pick, using the document's already-hosted URL as the
    // source — React Native's FormData/networking layer fetches http(s)
    // uris (not just local file:// paths) when building a multipart body,
    // the same mechanism that lets a remote image URI be re-posted without
    // downloading it to disk first.
    runImport(key, {
      uri: doc.url,
      name: doc.name ?? t('more:document_fallback_name', { defaultValue: 'Document' }).toString(),
      sizeBytes: doc.sizeBytes,
      mimeType: doc.mimeType,
    });
  };
  const onAnalyze = async () => {
    setIsAnalyzing(true);
    setLimitReached(false);
    try {
      const result = await resumeService.analyzeResume();
      setAtsScore(result.atsScore);
      setAtsTips(result.tips);
      setAnalyzed(true);
      void refreshSubscription();
    } catch (e: any) {
      if (e?.status === 402 && e?.error === 'resume_tool_limit_reached') {
        setLimitReached(true);
        setLimitMessage(e?.message ?? null);
      } else {
        Alert.alert(
          t('more:analysis_failed', { defaultValue: 'Analysis failed' }),
          e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onRewriteBullet = async () => {
    if (isRewriting || !bulletText.trim()) return;
    setIsRewriting(true);
    setLimitReached(false);
    try {
      // role/tone aren't collected by this screen today — fall back to the
      // user's first industry/goal from their profile as a best-effort
      // "role" hint, and a fixed professional tone. See resumeService.ts.
      const role = profile?.industries?.[0] ?? profile?.goals?.[0];
      const result = await resumeService.rewriteBullet(bulletText, { role, tone: 'professional' });
      setRewriteResult(result);
      void refreshSubscription();
    } catch (e: any) {
      if (e?.status === 402 && e?.error === 'resume_tool_limit_reached') {
        setLimitReached(true);
        setLimitMessage(e?.message ?? null);
      } else {
        Alert.alert(
          t('more:rewrite_failed', { defaultValue: 'Rewrite failed' }),
          e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
        );
      }
    } finally {
      setIsRewriting(false);
    }
  };

  // Was a full blanket `if (!isPro) return <ProLockGate/>` here -- removed,
  // see the free-plan cap comment above `limitReached`'s declaration. Free
  // users now see the real screen; the usage banner and limitReached card
  // below (rendered inline, past the Content padder) handle the capped
  // experience instead of a hard wall.

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:resume_builder', { defaultValue: 'Resume Builder' })}
        accessoryLeft={<NavigationAction onPress={goBack} />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h8" bold status="placeholder" mb={16}>
          {t('more:import_from', { defaultValue: 'Import from' })}
        </Text>
        <View style={styles.importGrid}>
          {IMPORT_OPTIONS.map(opt => {
            // Product follow-up ("the color style and blend is not
            // consistent throughout the app... use it in certain other
            // places too") — same pastel-icon-badge treatment
            // RecentActivityList.tsx uses on Home, keyed on opt.key so
            // each import source keeps a stable color.
            const accent = accentColorForKey(opt.key);
            return (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.7}
              onPress={() => onImport(opt.key)}
              style={styles.importCard}>
              {/* SYMPHONY follow-up (explicit product request: "I love the
                  way you gave the icons in this onboarding different color
                  backgrounds. I want the icons in the Resume builder...
                  to have backgrounds like that") — was a light ~12% tint
                  behind a colored icon (accentTintBg); now a solid fill
                  behind a white icon, matching components/
                  OnboardingCluster.tsx's badge treatment exactly. Same
                  ACCENT_PALETTE/accentColorForKey so each import source
                  still keeps a stable color, just rendered bolder. */}
              <View style={[styles.importIconWrap, { backgroundColor: 'transparent' }]}>
                <Icon
                  pack="assets"
                  name={opt.icon}
                  style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]}
                />
              </View>
              <Text category="h9" mt={8} bold center>
                {t(opt.titleKey, { defaultValue: opt.titleDefault })}
              </Text>
              <Text category="h9-s" mt={4} status={imported[opt.key] ? 'success' : 'placeholder'} numberOfLines={1}>
                {importingKey === opt.key
                  ? t('more:uploading', { defaultValue: 'Uploading…' })
                  : imported[opt.key]
                  ? imported[opt.key].name
                  : t('more:tap_to_upload', { defaultValue: 'Tap to upload' })}
              </Text>
            </TouchableOpacity>
            );
          })}
        </View>

        {/* Free-plan usage banner -- same shared pool (generate,
            cover_letter, ats_score, rewrite_bullet) as web's
            app/resume/builder/page.tsx. Only shown for non-Pro accounts
            once the backend has told us the limit (a fresh signup with no
            subscription payload yet just won't show it until the first
            successful refresh). */}
        {!isPro && subscription?.resumeToolActionsLimit != null ? (
          <Layout level="2" style={styles.usageBanner}>
            <Icon pack="eva" name="flash-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
            {(() => {
              const remaining = Math.max(0, subscription.resumeToolActionsLimit! - (subscription.resumeToolActionsUsed ?? 0));
              return (
                <Text category="h9-s" bold status={remaining > 0 ? 'basic' : 'danger'} ml={10} style={globalStyle.flexOne}>
                  {remaining > 0
                    ? t('more:resume_free_actions_remaining', {
                        defaultValue: `${remaining} free resume tool action${remaining === 1 ? '' : 's'} left this month`,
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

        <CtaButton
          children={
            isAnalyzing
              ? t('more:analyzing', { defaultValue: 'Analyzing…' })
              : t('more:analyze_resume', { defaultValue: 'Analyze My Resume' })
          }
          onPress={onAnalyze}
          disabled={isAnalyzing}
          style={[globalStyle.shadowBtn, { marginTop: 32 }]}
        />

        {/* AI-generated CV — same standard section set as the JD Analyzer's
            "Build Resume" flow (src/more/GenerateResume.tsx), just titled and
            exported as a CV instead of a resume. See services/
            resumeGenerationService.ts for the shared generation/export logic. */}
        <Button
          appearance="outline"
          children={t('more:create_cv', { defaultValue: 'Create My CV' })}
          onPress={() =>
            navigate('GenerateResume', {
              role: profile?.desiredRoles?.[0],
              docType: 'cv',
            })
          }
          style={{ marginTop: 12 }}
        />

        {/* AI Cover Letter Generator — pulls the same stored resume this
            screen manages, tailored to a company/role the user types on the
            next screen. See services/coverLetterService.ts and
            src/more/CoverLetterGenerator.tsx. */}
        <Button
          appearance="outline"
          status="basic"
          children={t('more:generate_cover_letter', { defaultValue: 'Generate Cover Letter' })}
          onPress={() => navigate('CoverLetterGenerator', { role: profile?.desiredRoles?.[0] })}
          style={{ marginTop: 12 }}
        />

        {analyzed ? (
          <>
            <Flex vertical itemsCenter justify="center" mt={40} mb={24}>
              {/* Redesign v2 (full reskin) — gradient ring, brand blue
                  (see components/CircleSlider.tsx's optional gradient
                  props), replacing the old flat progressStokeColor. */}
              <ProgressCard
                title={t('more:ats_score', { defaultValue: 'ATS Score' })}
                progress={atsScore}
                d={140}
                strokeWidth={10}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={theme['color-primary-500']}
                progressGradientFrom="#71717a"
                progressGradientTo="#71717a"
              />
            </Flex>
            <SectionTitle mt={0} mb={16}>
              {t('more:ats_tips', { defaultValue: 'Suggestions to improve your score' })}
            </SectionTitle>
            {atsTips.map((tip, i) => (
              <Layout key={i} level="2" style={styles.tipRow}>
                <Icon pack="assets" name="quote" style={[globalStyle.icon16, { tintColor: theme['text-basic-color'] }]} />
                <Text category="h9-s" ml={12} style={globalStyle.flexOne}>
                  {tip}
                </Text>
              </Layout>
            ))}
          </>
        ) : null}

        <SectionTitle mt={40} mb={12}>
          {t('more:ai_bullet_rewrite', { defaultValue: 'Rewrite a Bullet with AI' })}
        </SectionTitle>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('more:ai_bullet_rewrite_description', {
            defaultValue: 'Paste a resume bullet — we’ll tighten the wording and lead with a stronger verb.',
          })}
        </Text>
        <Input
          multiline
          textStyle={[globalStyle.inputText, styles.bulletInputText]}
          style={styles.bulletInput}
          placeholder={t('more:bullet_placeholder', {
            defaultValue: 'e.g. Responsible for managing the onboarding process for new hires',
          })}
          value={bulletText}
          onChangeText={setBulletText}
        />
        <CtaButton
          children={renderCenteredLabel(
            isRewriting
              ? t('more:rewriting', { defaultValue: 'Rewriting…' })
              : t('more:rewrite_with_ai', { defaultValue: 'Rewrite with AI' }),
            {stretch: false},
          )}
          disabled={isRewriting || !bulletText.trim()}
          onPress={onRewriteBullet}
          accessoryLeft={props => <Icon {...props} pack="assets" name="quote" style={{color:'#fff'}} />}
          style={{ marginTop: 12, }}
        />
        {rewriteResult && rewriteResult.rewritten ? (
          <View style={{ marginTop: 20 }}>
            <Layout level="2" style={styles.bulletCard}>
              <Text category="h10" bold status="placeholder" mb={6}>
                {t('more:before', { defaultValue: 'BEFORE' })}
              </Text>
              <Text category="h9-s">{bulletText.trim()}</Text>
            </Layout>
            <Layout level="2" style={[styles.bulletCard, { marginTop: 12, borderColor: theme['color-primary-500'], borderWidth: 1 }]}>
              <Text category="h10" bold status="success" mb={6}>
                {t('more:after', { defaultValue: 'AFTER' })}
              </Text>
              <Text category="h9-s" bold>{rewriteResult.rewritten}</Text>
              <Text category="h10" status="placeholder" mt={10}>
                {rewriteResult.explanation}
              </Text>
            </Layout>
          </View>
        ) : null}
      </Content>

      <DocumentPickerModal
        visible={!!documentPickerFor}
        onClose={() => setDocumentPickerFor(null)}
        onSelect={onPickFromMyDocuments}
      />
    </Container>
  );
});

export default ResumeBuilder;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  // Was justifyContent: 'space-between' with 5 cards in a 3-per-row grid --
  // fine for a full row of 3, but the trailing row of 2 (Certificates,
  // Transcript) got stretched to opposite edges of the screen with a huge
  // gap between them, since space-between always spreads its children
  // across the full row width regardless of how many there are. `gap`
  // (RN 0.71+) keeps a fixed, consistent spacing between cards whether a
  // row is full or not, closing that gap on the last row.
  importGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 10,
  },
  importCard: {
    ...globalStyle.card,
    width: '30%',
    // Redesign v2 (full reskin): `card` carries a real shadow again, which
    // needs an opaque fill to render correctly on Android (was
    // 'transparent') — this renders on a plain TouchableOpacity (no
    // `level` prop), so the fill has to live here.
    backgroundColor: 'background-basic-color-2',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 12,
  },
  // Same pastel-icon-badge circle RecentActivityList.tsx's iconWrap uses
  // on Home (38x38/radius 13) — sized down slightly to fit these narrower
  // 30%-width cards.
  importIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  // Free-plan resume-tool usage banner / limit-reached card (task #53) --
  // same rounded card treatment as tipRow/bulletCard above.
  usageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
  },
  limitCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  limitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletInput: {
    ...globalStyle.inputField,
    minHeight: 80,
  },
  bulletInputText: {
    fontFamily: 'PlusJakartaSans-Regular',
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  bulletCard: {
    ...globalStyle.card,
    padding: 16,
  },
});
