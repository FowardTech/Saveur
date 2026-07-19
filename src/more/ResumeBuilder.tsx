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
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import * as resumeService from 'services/resumeService';
import { ImportedFileInfo, ResumeImportSourceKey, RewriteBulletResult } from 'services/resumeService';
import { AuthContext } from '../../AuthContext';

const IMPORT_OPTIONS: Array<{ key: ResumeImportSourceKey; title: string; icon: string }> = [
  { key: 'resume', title: 'Resume', icon: 'myPost' },
  { key: 'linkedin', title: 'LinkedIn', icon: 'searchHistory' },
  { key: 'portfolio', title: 'Portfolio', icon: 'photoLibrary' },
  { key: 'certificates', title: 'Certificates', icon: 'bgCheck' },
  { key: 'transcript', title: 'Transcript', icon: 'term' },
];

// Real device file access — each "import" option below opens the native
// document picker (@react-native-documents/picker) instead of simulating an
// upload, so users pick an actual file from their phone/iCloud/Drive/etc.
// See services/resumeService.ts for what happens to the picked file
// afterward — it's uploaded as multipart/form-data to POST /resume/upload.
async function pickDocument(): Promise<ImportedFileInfo | null> {
  try {
    const [result] = await pick({
      type: [documentTypes.pdf, documentTypes.doc, documentTypes.docx, documentTypes.plainText, documentTypes.images],
    });
    return {
      uri: result.uri,
      name: result.name ?? 'Selected file',
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
  const { goBack } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { profile } = React.useContext(AuthContext);

  const [imported, setImported] = React.useState<Record<string, ImportedFileInfo>>({});
  const [importingKey, setImportingKey] = React.useState<ResumeImportSourceKey | null>(null);
  const [analyzed, setAnalyzed] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [atsScore, setAtsScore] = React.useState(0);
  const [atsTips, setAtsTips] = React.useState<string[]>([]);

  const [bulletText, setBulletText] = React.useState('');
  const [isRewriting, setIsRewriting] = React.useState(false);
  const [rewriteResult, setRewriteResult] = React.useState<RewriteBulletResult | null>(null);

  React.useEffect(() => {
    resumeService.getImportedSources().then(setImported).catch(() => {
      // getImportedSources already falls back to its offline cache on
      // failure and resolves rather than rejecting, but guard anyway so a
      // truly unexpected error doesn't surface as an unhandled rejection on
      // mount.
    });
  }, []);

  const onImport = async (key: ResumeImportSourceKey) => {
    const file = await pickDocument();
    if (!file) return; // user canceled the native picker
    setImportingKey(key);
    try {
      await resumeService.importSource(key, file);
      setImported(prev => ({ ...prev, [key]: file }));
    } catch (e: any) {
      Alert.alert(
        t('more:upload_failed', { defaultValue: 'Upload failed' }),
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setImportingKey(null);
    }
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
        e?.message ?? 'Something went wrong. Please try again.',
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
        e?.message ?? 'Something went wrong. Please try again.',
      );
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:resume_builder', { defaultValue: 'Resume Builder' })}
        accessoryLeft={<NavigationAction onPress={goBack} />}
      />
      <Content padder contentContainerStyle={styles.content}>
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
              <Icon
                pack="assets"
                name={opt.icon}
                style={[globalStyle.icon24, { tintColor: '#181b22' }]}
              />
              <Text category="h9" mt={8} bold center>
                {opt.title}
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

        <Button
          children={
            isAnalyzing
              ? t('more:analyzing', { defaultValue: 'Analyzing…' })
              : t('more:analyze_resume', { defaultValue: 'Analyze My Resume' })
          }
          onPress={onAnalyze}
          disabled={isAnalyzing}
          style={[globalStyle.shadowBtn, { marginTop: 32 }]}
        />

        {analyzed ? (
          <>
            <Flex center vertical mt={40} mb={24}>
              <ProgressCard
                title={t('more:ats_score', { defaultValue: 'ATS Score' })}
                progress={atsScore}
                d={140}
                strokeWidth={10}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={theme['color-primary-500']}
              />
            </Flex>
            <Text category="h6" bold mb={16}>
              {t('more:ats_tips', { defaultValue: 'Suggestions to improve your score' })}
            </Text>
            {atsTips.map((tip, i) => (
              <Layout key={i} level="2" style={styles.tipRow}>
                <Icon pack="assets" name="quote" style={[globalStyle.icon16, { tintColor: theme['color-primary-500'] }]} />
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
          textStyle={styles.bulletInputText}
          style={styles.bulletInput}
          placeholder={t('more:bullet_placeholder', {
            defaultValue: 'e.g. Responsible for managing the onboarding process for new hires',
          })}
          value={bulletText}
          onChangeText={setBulletText}
        />
        <Button
          children={
            isRewriting
              ? t('more:rewriting', { defaultValue: 'Rewriting…' })
              : t('more:rewrite_with_ai', { defaultValue: 'Rewrite with AI' })
          }
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
  importGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  importCard: {
    width: '31%',
    borderRadius: 16,
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
    borderRadius: 12,
    minHeight: 80,
  },
  bulletInputText: {
    fontFamily: 'GothamPro',
    fontSize: 13,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  bulletCard: {
    borderRadius: 12,
    padding: 16,
  },
});
