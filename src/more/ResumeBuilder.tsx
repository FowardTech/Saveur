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
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

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
  const { profile, isPro } = React.useContext(AuthContext);

  const [imported, setImported] = React.useState<Record<string, ImportedFileInfo>>({});
  const [importingKey, setImportingKey] = React.useState<ResumeImportSourceKey | null>(null);
  const [analyzed, setAnalyzed] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [atsScore, setAtsScore] = React.useState(0);
  const [atsTips, setAtsTips] = React.useState<string[]>([]);

  const [bulletText, setBulletText] = React.useState('');
  const [isRewriting, setIsRewriting] = React.useState(false);
  const [rewriteResult, setRewriteResult] = React.useState<RewriteBulletResult | null>(null);

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
    try {
      const result = await resumeService.analyzeResume();
      setAtsScore(result.atsScore);
      setAtsTips(result.tips);
      setAnalyzed(true);
    } catch (e: any) {
      Alert.alert(
        t('more:analysis_failed', { defaultValue: 'Analysis failed' }),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onRewriteBullet = async () => {
    if (isRewriting || !bulletText.trim()) return;
    setIsRewriting(true);
    try {
      // role/tone aren't collected by this screen today — fall back to the
      // user's first industry/goal from their profile as a best-effort
      // "role" hint, and a fixed professional tone. See resumeService.ts.
      const role = profile?.industries?.[0] ?? profile?.goals?.[0];
      const result = await resumeService.rewriteBullet(bulletText, { role, tone: 'professional' });
      setRewriteResult(result);
    } catch (e: any) {
      Alert.alert(
        t('more:rewrite_failed', { defaultValue: 'Rewrite failed' }),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsRewriting(false);
    }
  };

  if (!isPro) {
    // BUG FIX (product report: resume builder content stuck in English) —
    // this gate's title/description were plain string literals, not even
    // passed through t(), so a non-Pro user landing here always saw English
    // no matter their selected language.
    return (
      <ProLockGate
        title={t('more:resume_builder', { defaultValue: 'Resume Builder' })}
        description={t('more:resume_builder_pro_gate_description', {
          defaultValue: 'Import your resume, get AI bullet rewrites, and build an ATS-ready document — Resume Builder is a Pro feature.',
        })}
      />
    );
  }

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
          {IMPORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.7}
              onPress={() => onImport(opt.key)}
              style={styles.importCard}>
              {/* Was a hardcoded tintColor: '#181b22' (near-black) --
                 invisible against a dark card background in dark mode.
                 theme['text-basic-color'] tracks the theme correctly (dark
                 text in light mode, light text in dark mode). */}
              <Icon
                pack="assets"
                name={opt.icon}
                style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]}
              />
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
          ))}
        </View>

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
                progressGradientFrom="#1DA1F2"
                progressGradientTo="#0063f8"
              />
            </Flex>
            <Text category="h6" bold mb={16}>
              {t('more:ats_tips', { defaultValue: 'Suggestions to improve your score' })}
            </Text>
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

        <Text category="h6" bold mt={40} mb={4}>
          {t('more:ai_bullet_rewrite', { defaultValue: 'Rewrite a Bullet with AI' })}
        </Text>
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
          accessoryLeft={props => <Icon {...props} pack="assets" name="quote" />}
          style={{ marginTop: 12 }}
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
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
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
