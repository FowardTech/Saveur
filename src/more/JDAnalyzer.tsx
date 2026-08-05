import React, { memo } from 'react';
import { View, Alert } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Input,
  Button,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import ProgressCard from 'src/find/Component/ProgressCard';
import DocumentPickerModal from 'components/DocumentPickerModal';
import { globalStyle } from 'styles/globalStyle';
import { lightenColor } from 'utils/color';
import { RootStackParamList } from 'navigation/types';
import * as jdService from 'services/jdService';
import { JDAnalysisResult } from 'services/jdService';
import { DocumentRecord } from 'services/documentsService';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import CtaButton from 'components/CtaButton';

// Job-description analyzer: paste a JD, get a match score + gap analysis via
// jdService, which calls POST /jd/analyze and POST /jd/match in parallel and
// merges them (see services/jdService.ts).
//
// Product request item: "let users paste a job posting URL instead of the
// full job description text." Adds a second input mode alongside the
// original paste-text one — a simple two-way tab, not a separate screen,
// since both modes feed the exact same downstream analysis. Submitting a
// URL first resolves it server-side to plain jd_text (POST
// /jd/extract-url — see jdService.ts), then reuses
// analyzeJobDescription(jdText) completely unchanged; from that point on a
// URL-sourced analysis is indistinguishable from a pasted-text one.
type InputMode = 'text' | 'url';

const JDAnalyzer = memo(() => {
  const { goBack, navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPro } = React.useContext(AuthContext);

  const [inputMode, setInputMode] = React.useState<InputMode>('text');
  const [jd, setJd] = React.useState('');
  const [jdUrl, setJdUrl] = React.useState('');
  const [result, setResult] = React.useState<JDAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  // Distinct from isAnalyzing so the button label can say "Fetching…"
  // during the URL-resolve step, before the normal analyze/match calls
  // (which is what isAnalyzing already covers) even start.
  const [isFetchingUrl, setIsFetchingUrl] = React.useState(false);
  // "Tailor an existing resume" flow (product request item 1) — a
  // document-picker sheet for the "pick a file from My Documents"
  // sub-choice below. Reuses the exact same picker ResumeBuilder.tsx's
  // import cards use (see components/DocumentPickerModal.tsx).
  const [showDocumentPicker, setShowDocumentPicker] = React.useState(false);

  const switchMode = React.useCallback((mode: InputMode) => {
    setInputMode(mode);
    setResult(null);
  }, []);

  const onAnalyze = async () => {
    if (isAnalyzing || isFetchingUrl) return;
    let jdText = jd;
    if (inputMode === 'url') {
      if (!jdUrl.trim()) return;
      setIsFetchingUrl(true);
      try {
        jdText = await jdService.extractJDFromUrl(jdUrl);
      } catch (e: any) {
        setIsFetchingUrl(false);
        Alert.alert(
          t('more:jd_url_fetch_failed', { defaultValue: "Couldn't read that job posting" }),
          e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
        );
        return;
      }
      setIsFetchingUrl(false);
      if (!jdText.trim()) {
        Alert.alert(
          t('more:jd_url_fetch_failed', { defaultValue: "Couldn't read that job posting" }),
          t('more:jd_url_empty_result', { defaultValue: 'Try pasting the job description text instead.' }),
        );
        return;
      }
      // Mirrored into the same `jd` state the text tab uses — the "Build
      // Resume" CTA below (and any other downstream consumer of this
      // screen's result) always reads jdText off `jd`, regardless of which
      // tab originally produced it, so a URL-sourced analysis needs this
      // populated too or GenerateResume would receive an empty jdText.
      setJd(jdText);
    }
    if (!jdText.trim()) return;
    setIsAnalyzing(true);
    try {
      const analysis = await jdService.analyzeJobDescription(jdText);
      setResult(analysis);
    } catch (e: any) {
      Alert.alert(
        t('more:analysis_failed', { defaultValue: 'Analysis failed' }),
        e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'}),
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isBusy = isAnalyzing || isFetchingUrl;
  const canSubmit = inputMode === 'text' ? !!jd.trim() : !!jdUrl.trim();

  // Product request item 1 — "give the user option to build resume
  // (tailor) using one of the uploaded documents or build a fresh one".
  // A plain Alert action-sheet, same idiom ResumeBuilder.tsx's own
  // "Import from" choice already uses (device vs. My Documents) — no need
  // for a bespoke modal for a one-off 2/3-way choice like this.
  const buildFresh = () => {
    if (!result) return;
    navigate('GenerateResume', {
      keywordSuggestions: result.keywordSuggestions,
      missingSkills: result.missingSkills,
      jdText: jd,
    });
  };

  const tailorFromStoredResume = () => {
    if (!result) return;
    navigate('GenerateResume', {
      keywordSuggestions: result.keywordSuggestions,
      missingSkills: result.missingSkills,
      jdText: jd,
      useStoredResume: true,
    });
  };

  const onPickedDocumentToTailor = (doc: DocumentRecord) => {
    setShowDocumentPicker(false);
    if (!result) return;
    navigate('GenerateResume', {
      keywordSuggestions: result.keywordSuggestions,
      missingSkills: result.missingSkills,
      jdText: jd,
      existingResumeDocumentId: doc.id,
    });
  };

  // Product request item: "Cover letter too can be generated in the JD to
  // match the job description" — CoverLetterGenerator.tsx already accepts
  // an optional jdText route param (used nowhere before this) and blends
  // it into the cover-letter prompt server-side (POST /resume/cover-letter
  // already accepts jd_text) — no backend change needed, just a way to
  // reach it from here with this JD's text pre-attached. company/role stay
  // as manual inputs on that screen (same as this screen never collected
  // them either) rather than trying to guess them out of raw JD text.
  const onGenerateCoverLetter = () => {
    if (!result) return;
    navigate('CoverLetterGenerator', { jdText: jd });
  };

  const onBuildResume = () => {
    Alert.alert(
      t('more:build_matching_resume_cta', { defaultValue: 'Build Resume' }),
      t('more:build_resume_choice_description', {
        defaultValue: 'Tailor a resume you already have to this job, or build a brand-new one from scratch.',
      }),
      [
        { text: t('common:cancel', { defaultValue: 'Cancel' }).toString(), style: 'cancel' },
        {
          text: t('more:build_resume_fresh', { defaultValue: 'Build a fresh one' }).toString(),
          onPress: buildFresh,
        },
        {
          text: t('more:build_resume_tailor', { defaultValue: 'Tailor an existing resume' }).toString(),
          onPress: () =>
            Alert.alert(
              t('more:build_resume_tailor', { defaultValue: 'Tailor an existing resume' }),
              undefined,
              [
                { text: t('common:cancel', { defaultValue: 'Cancel' }).toString(), style: 'cancel' },
                {
                  text: t('more:tailor_my_generated_resume', { defaultValue: 'My generated resume' }).toString(),
                  onPress: tailorFromStoredResume,
                },
                {
                  text: t('more:choose_from_my_documents', { defaultValue: 'Choose from My Documents' }).toString(),
                  onPress: () => setShowDocumentPicker(true),
                },
              ],
            ),
        },
      ],
    );
  };

  if (!isPro) {
    return (
      <ProLockGate
        title={t('more:jd_analyzer', { defaultValue: 'JD Analyzer' })}
        description={t('more:jd_analyzer_pro_gate_description', {
          defaultValue: "Paste a job description and see how your resume stacks up, with a matching resume generated for you — JD Analyzer is a Pro feature.",
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:jd_analyzer', { defaultValue: 'JD Analyzer' })}
        accessoryLeft={<NavigationAction onPress={goBack} />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {/* Paste text / Paste URL tabs — two input modes feeding the same
            downstream analysis (see this file's top comment). A plain
            two-button toggle rather than a full TabView/TabBar component,
            since there's nothing else on this screen that needs to switch
            with it (just the one input area below). */}
        <Flex style={styles.modeToggle}>
          <Button
            appearance={inputMode === 'text' ? 'filled' : 'ghost'}
            status={inputMode === 'text' ? 'primary' : 'basic'}
            size="small"
            style={styles.modeButton}
            onPress={() => switchMode('text')}
          >
            {t('more:paste_text', { defaultValue: 'Paste text' }).toString()}
          </Button>
          <Button
            appearance={inputMode === 'url' ? 'filled' : 'ghost'}
            status={inputMode === 'url' ? 'primary' : 'basic'}
            size="small"
            style={styles.modeButton}
            onPress={() => switchMode('url')}
          >
            {t('more:paste_url', { defaultValue: 'Paste URL' }).toString()}
          </Button>
        </Flex>

        {inputMode === 'text' ? (
          <>
            <Text category="h8" bold status="placeholder" mb={12}>
              {t('more:paste_job_description', { defaultValue: 'Paste a job description' })}
            </Text>
            <Input
              multiline
              scrollEnabled
              textStyle={styles.jdText}
              style={styles.jdInput}
              value={jd}
              onChangeText={setJd}
            />
          </>
        ) : (
          <>
            <Text category="h8" bold status="placeholder" mb={12}>
              {t('more:paste_job_url', { defaultValue: 'Paste a job posting link' })}
            </Text>
            <Input
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={t('more:job_url_placeholder', {
                defaultValue: 'e.g. https://jobs.lever.co/company/role',
              }).toString()}
              value={jdUrl}
              onChangeText={setJdUrl}
              disabled={isFetchingUrl}
            />
            <Text category="h9-s" status="placeholder" mt={8}>
              {t('more:job_url_hint', {
                defaultValue: "We'll fetch the posting and pull out the job description for you.",
              })}
            </Text>
          </>
        )}
        <CtaButton
          children={
            isFetchingUrl
              ? t('more:fetching_posting', { defaultValue: 'Fetching posting…' })
              : isAnalyzing
              ? t('more:analyzing', { defaultValue: 'Analyzing…' })
              : t('more:analyze', { defaultValue: 'Analyze Match' })
          }
          onPress={onAnalyze}
          disabled={isBusy || !canSubmit}
          style={[globalStyle.shadowBtn, { marginTop: 24 }]}
        />

        {result ? (
          <>
            <Flex center vertical mt={40} mb={24}>
              {/* Redesign v2 (full reskin) — gradient ring, but keeps the
                  existing success/warning/danger "traffic light" semantics
                  intact: gradient "from" stop is a lighter tint of
                  whichever base color the threshold already picked (see
                  utils/color.ts's lightenColor), not a fixed brand-blue
                  gradient — a flat blue gradient here would lose the
                  meaningful red/amber/green signal this ring exists to
                  give. */}
              <ProgressCard
                title={t('more:match_score', { defaultValue: 'Match Score' })}
                progress={result.score}
                d={140}
                strokeWidth={10}
                stokeColor={theme['background-basic-color-3']}
                progressStokeColor={
                  result.score >= 75
                    ? theme['color-success-500']
                    : result.score >= 50
                    ? theme['color-warning-500']
                    : theme['color-danger-500']
                }
                progressGradientFrom={lightenColor(
                  result.score >= 75
                    ? theme['color-success-500']
                    : result.score >= 50
                    ? theme['color-warning-500']
                    : theme['color-danger-500'],
                )}
                progressGradientTo={
                  result.score >= 75
                    ? theme['color-success-500']
                    : result.score >= 50
                    ? theme['color-warning-500']
                    : theme['color-danger-500']
                }
              />
            </Flex>

            <Text category="h6" bold mb={16}>
              {t('more:missing_skills', { defaultValue: 'Missing Skills' })}
            </Text>
            <View style={styles.chipsWrap}>
              {result.missingSkills.map((skill, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: theme['color-danger-transparent-200'] }]}>
                  <Text category="h9" status="danger" bold>
                    {skill}
                  </Text>
                </View>
              ))}
            </View>

            <Text category="h6" bold mt={24} mb={16}>
              {t('more:keyword_suggestions', { defaultValue: 'Keyword Suggestions' })}
            </Text>
            <View style={styles.chipsWrap}>
              {result.keywordSuggestions.map((word, i) => (
                <View key={i} style={[styles.chip, { backgroundColor: theme['color-success-transparent-200'] }]}>
                  {/* BUG FIX (illegible green pill text): `status="success"`
                      resolves to this app's palette's lightest green shade,
                      almost invisible against this same pale green fill.
                      `color-success-200` is the darker shade already used
                      elsewhere for legible text-on-light-fill. */}
                  <Text category="h9" bold style={{color: theme['color-success-200']}}>
                    {word}
                  </Text>
                </View>
              ))}
            </View>

            <Flex level="2" style={styles.buildResumeCard} vertical justify="flex-start" mt={32}>
              <Text category="h7" bold mb={4}>
                {t('more:build_matching_resume_title', { defaultValue: 'Want a resume tailored to this job?' })}
              </Text>
              <Text category="h9-s" status="placeholder" mb={16}>
                {t('more:build_matching_resume_description', {
                  defaultValue: "We'll draft a resume around this job's keywords and skills, ready to download.",
                })}
              </Text>
              <CtaButton
                children={t('more:build_matching_resume_cta', { defaultValue: 'Build Resume' })}
                onPress={onBuildResume}
              />
            </Flex>

            <Flex level="2" style={styles.buildResumeCard} vertical justify="flex-start" mt={16}>
              <Text category="h7" bold mb={4}>
                {t('more:build_matching_cover_letter_title', { defaultValue: 'Want a cover letter for this job?' })}
              </Text>
              <Text category="h9-s" status="placeholder" mb={16}>
                {t('more:build_matching_cover_letter_description', {
                  defaultValue: "We'll draft a cover letter tailored to this job description, ready to download.",
                })}
              </Text>
              <CtaButton
                children={t('more:build_matching_cover_letter_cta', { defaultValue: 'Generate Cover Letter' })}
                onPress={onGenerateCoverLetter}
              />
            </Flex>
          </>
        ) : null}
      </Content>

      <DocumentPickerModal
        visible={showDocumentPicker}
        onClose={() => setShowDocumentPicker(false)}
        onSelect={onPickedDocumentToTailor}
        title={t('more:build_resume_tailor', { defaultValue: 'Tailor an existing resume' }).toString()}
      />
    </Container>
  );
});

export default JDAnalyzer;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  modeToggle: {
    marginBottom: 16,
  },
  modeButton: {
    marginRight: 8,
    borderRadius: 20,
  },
  jdInput: {
    borderRadius: 16,
    backgroundColor: 'background-basic-color-2',
    // Fixed height (not minHeight) so pasting a long job description makes
    // the text scroll inside the box instead of pushing the box itself
    // (and everything below it, including the Analyze button) further down
    // the screen every keystroke. A fixed height alone doesn't actually
    // clip a multiline TextInput's content though -- without
    // `scrollEnabled` on the Input (above) and `overflow: 'hidden'` here,
    // the text just kept rendering past the box's bottom edge instead of
    // scrolling inside it, which is what was actually happening before.
    height: 260,
    overflow: 'hidden',
  },
  jdText: {
    height: '100%',
    textAlignVertical: 'top',
    minHeight: 200,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  buildResumeCard: {
    ...globalStyle.card,
    padding: 20,
  },
});
