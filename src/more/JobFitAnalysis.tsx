import React, {memo} from 'react';
import {View, Alert} from 'react-native';
import {StyleService, useStyleSheet, useTheme, Spinner} from '@ui-kitten/components';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import Text from 'components/Text';
import Flex from 'components/Flex';
import CtaButton from 'components/CtaButton';
import StatusBadge from 'components/StatusBadge';
import DocumentPickerModal from 'components/DocumentPickerModal';
import {RootStackParamList} from 'navigation/types';
import * as jdService from 'services/jdService';
import {DocumentRecord} from 'services/documentsService';

// Product request item: "on the job detail screen, show qualification pills
// and a resume gap analysis" — this reuses the exact same analysis pipeline
// JDAnalyzer.tsx already has (jdService.analyzeJD + matchJD, both backed by
// POST /jd/analyze and POST /jd/match) rather than building a second one,
// just sourced from the alert's own apply_url (via jdService.extractJDFromUrl,
// the same "Paste URL" path JDAnalyzer's URL tab uses) instead of a
// user-pasted job description.
//
// Auto-runs once on mount rather than waiting for a tap — this screen only
// has one job to analyze (unlike JDAnalyzer, a general-purpose tool), so
// there's no real "maybe I don't want this yet" case to gate behind a
// button. Silently hides on any failure (unreachable posting, a page that
// doesn't read as a job posting, empty JD text) rather than showing an
// error — same "self-hide, don't nag" convention every other
// best-effort/self-contained card in this app follows (see
// src/home/DailyNewsBanner.tsx, DailyTipsBanner.tsx). The rest of the job
// details screen is fully useful without this section, so a failure here
// should never block or clutter it.
//
// Gating: this screen (JobAlertDetails.tsx) already requires Pro Premium to
// even be reached, and /jd/analyze + /jd/match both only require plain Pro
// (entitlements_service.require_pro) — Premium is a strict superset of Pro
// (see entitlements_service.py's own docstring), so any user who got past
// JobAlertDetails' gate already satisfies these endpoints' gate too. No
// separate check needed here.
interface JobFitAnalysisProps {
  applyUrl?: string | null;
  jobTitle?: string;
}

const JobFitAnalysis = memo(({applyUrl, jobTitle}: JobFitAnalysisProps) => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const {t} = useTranslation(['more', 'common']);
  const {navigate} = useNavigation<NavigationProp<RootStackParamList>>();

  const [isLoading, setIsLoading] = React.useState(false);
  const [jdText, setJdText] = React.useState<string | null>(null);
  const [qualifications, setQualifications] = React.useState<string[]>([]);
  const [gaps, setGaps] = React.useState<string[]>([]);
  const [score, setScore] = React.useState<number | null>(null);
  const [failed, setFailed] = React.useState(false);
  // "Tailor an existing resume" flow (product request: "give the user
  // option to either build a fresh resume or tailor the resume already in
  // the app... just the way it does in the JD Analyzer screen") — mirrors
  // JDAnalyzer.tsx's onBuildResume exactly (same nested Alert.alert idiom,
  // same DocumentPickerModal for the "My Documents" sub-choice), just
  // sourced from this screen's own jdText/qualifications/gaps/jobTitle
  // instead of JDAnalyzer's pasted-JD result.
  const [showDocumentPicker, setShowDocumentPicker] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!applyUrl) {
      setFailed(true);
      return;
    }
    setIsLoading(true);
    (async () => {
      try {
        const text = await jdService.extractJDFromUrl(applyUrl);
        if (!text.trim()) throw new Error('empty jd');
        const [analysis, match] = await Promise.all([
          jdService.analyzeJD(text),
          jdService.matchJD(text),
        ]);
        if (cancelled) return;
        setJdText(text);
        // Qualifications pills = what the posting actually asks for
        // (must-have requirements the model pulled out); falls back to
        // general keywords if the model didn't isolate any must-haves,
        // same fallback jdService.analyzeJobDescription's merged shape
        // already relies on for "Missing Skills" in JDAnalyzer.
        setQualifications(analysis.mustHaves.length ? analysis.mustHaves : analysis.keywords);
        setGaps(match.missingSkills);
        setScore(match.score);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUrl]);

  const buildFresh = React.useCallback(() => {
    if (!jdText) return;
    navigate('GenerateResume', {
      keywordSuggestions: qualifications,
      missingSkills: gaps,
      jdText,
      role: jobTitle,
    });
  }, [navigate, jdText, qualifications, gaps, jobTitle]);

  const tailorFromStoredResume = React.useCallback(() => {
    if (!jdText) return;
    navigate('GenerateResume', {
      keywordSuggestions: qualifications,
      missingSkills: gaps,
      jdText,
      role: jobTitle,
      useStoredResume: true,
    });
  }, [navigate, jdText, qualifications, gaps, jobTitle]);

  const onPickedDocumentToTailor = React.useCallback(
    (doc: DocumentRecord) => {
      setShowDocumentPicker(false);
      if (!jdText) return;
      navigate('GenerateResume', {
        keywordSuggestions: qualifications,
        missingSkills: gaps,
        jdText,
        role: jobTitle,
        existingResumeDocumentId: doc.id,
      });
    },
    [navigate, jdText, qualifications, gaps, jobTitle],
  );

  const onBuildResume = React.useCallback(() => {
    if (!jdText) return;
    Alert.alert(
      t('more:build_matching_resume_cta', {defaultValue: 'Build Resume'}),
      t('more:build_resume_choice_description', {
        defaultValue: 'Tailor a resume you already have to this job, or build a brand-new one from scratch.',
      }),
      [
        {text: t('common:cancel', {defaultValue: 'Cancel'}).toString(), style: 'cancel'},
        {
          text: t('more:build_resume_fresh', {defaultValue: 'Build a fresh one'}).toString(),
          onPress: buildFresh,
        },
        {
          text: t('more:build_resume_tailor', {defaultValue: 'Tailor an existing resume'}).toString(),
          onPress: () =>
            Alert.alert(
              t('more:build_resume_tailor', {defaultValue: 'Tailor an existing resume'}),
              undefined,
              [
                {text: t('common:cancel', {defaultValue: 'Cancel'}).toString(), style: 'cancel'},
                {
                  text: t('more:tailor_my_generated_resume', {defaultValue: 'My generated resume'}).toString(),
                  onPress: tailorFromStoredResume,
                },
                {
                  text: t('more:choose_from_my_documents', {defaultValue: 'Choose from My Documents'}).toString(),
                  onPress: () => setShowDocumentPicker(true),
                },
              ],
            ),
        },
      ],
    );
  }, [jdText, t, buildFresh, tailorFromStoredResume]);

  if (failed) return null;

  if (isLoading) {
    return (
      <Flex justify="flex-start" itemsCenter style={styles.loadingRow}>
        <Spinner size="small" status="basic" />
        <Text category="h9" status="placeholder" ml={10}>
          {t('more:job_fit_analyzing', {defaultValue: "Analyzing this role's requirements…"})}
        </Text>
      </Flex>
    );
  }

  if (!qualifications.length && !gaps.length) return null;

  return (
    <>
      <View style={styles.section}>
      {qualifications.length ? (
        <>
          <Flex justify="space-between" itemsCenter mb={12}>
            <Text category="h7" bold>
              {t('more:job_qualifications_title', {defaultValue: 'Qualifications'})}
            </Text>
            {score !== null ? (
              <StatusBadge
                variant={score >= 75 ? 'success' : score >= 50 ? 'warning' : 'danger'}
                label={t('more:match_score_pct', {defaultValue: '{{score}}% match', score}).toString()}
              />
            ) : null}
          </Flex>
          <View style={styles.chipsStack}>
            {qualifications.map((q, i) => (
              <View key={i} style={[styles.qualificationChip, {backgroundColor: theme['background-basic-color-3']}]}>
                <Text category="h9" bold>
                  {q}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {gaps.length ? (
        <>
          <Text category="h7" bold mt={20} mb={12}>
            {t('more:missing_skills', {defaultValue: 'Missing Skills'})}
          </Text>
          <View style={styles.chipsWrap}>
            {gaps.map((skill, i) => (
              <View key={i} style={[styles.chip, {backgroundColor: theme['color-danger-transparent-200']}]}>
                <Text category="h9" status="danger" bold>
                  {skill}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text category="h9-s" status="success" mt={20}>
          {t('more:job_fit_no_gaps', {defaultValue: 'Your resume already covers this role\'s key requirements.'})}
        </Text>
      )}

      {jdText ? (
        <CtaButton
          children={t('more:build_matching_resume_cta', {defaultValue: 'Build Resume'})}
          onPress={onBuildResume}
          style={{marginTop: 20}}
        />
      ) : null}
      </View>
      <DocumentPickerModal
        visible={showDocumentPicker}
        onClose={() => setShowDocumentPicker(false)}
        onSelect={onPickedDocumentToTailor}
        title={t('more:build_resume_tailor', {defaultValue: 'Tailor an existing resume'}).toString()}
      />
    </>
  );
});

export default JobFitAnalysis;

const themedStyles = StyleService.create({
  loadingRow: {
    paddingVertical: 16,
  },
  // BUG FIX (product report, round 2: "still looking bad... remove the
  // shadow in the pill"): the pills themselves never had a shadow (see
  // qualificationChip below) -- this OUTER section was the real source.
  // It spread globalStyle.card (padding + a real drop shadow) but never
  // set a backgroundColor, so it never actually looked like a card -- no
  // visible white/gray fill, no rounded edge -- yet it still cast the
  // shadow around its whole bounding box (iOS shadows render regardless of
  // fill opacity). The result was a shadow with no visible card to justify
  // it, floating around the pill list. Dropped the card spread entirely;
  // this was never meant to read as its own card in the first place, it
  // sits inside JobAlertDetails' own page content, not as a nested card.
  section: {
    padding: 20,
    marginBottom: 24,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Qualifications pills (product report: "not looking nice in light mode
  // -- stacked too close and the box shadow is too much... since they're
  // gray there's no need for a shadow, the app background is already
  // white"). These used to share chipsWrap/chip with the Missing Skills
  // chips below, but real qualification strings pulled from a job posting
  // ("Ability to work flexible shifts including overtime and weekends in
  // December/January") are full sentences, not short skill words -- inside
  // a flexWrap row they were never actually sitting side by side, just
  // incidentally landing one per line because each one was too wide to
  // share a row. Making that an explicit vertical stack (rather than a
  // wrapping row that happens to behave like one) with real spacing between
  // items and a plainer rounded-box shape (not a 99-radius capsule, which
  // on a two-line pill just reads as an odd shape) fixes both complaints at
  // once. No shadow -- the gray fill (background-basic-color-3) is already
  // enough contrast against the white page.
  chipsStack: {
    gap: 10,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  qualificationChip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
});
