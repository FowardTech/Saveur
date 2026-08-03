import React, { memo } from 'react';
import { Alert, Platform, View, TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Input,
} from '@ui-kitten/components';
import { NavigationProp, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList, MockInterviewSetupScreenNavigationProp } from 'navigation/types';
import { DATA_PRACTICE_MODES, DATA_INTERVIEW_TYPES, DATA_DIFFICULTY, DATA_COMPANIES, COMPANY_ANY } from 'constants/Data';
import { Difficulty_Enum, Interview_Type_Enum, Practice_Mode_Enum } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as configService from 'services/configService';
import { getSessionEntitlement } from 'services/entitlementsService';
import { getInterviewTypeLabel, getPracticeModeLabel, getPracticeModeDescription, getDifficultyLabel } from 'utils/interviewTypeLabels';
import { AuthContext } from '../../AuthContext';
import CtaButton from 'components/CtaButton';

const DURATION_OPTIONS_MIN = [15, 30, 45, 60];

// Setup wizard for a mock interview: pick mode, interview type, target role,
// difficulty, company, and session length. "Start" kicks off a real session
// via interviewService.startSession (POST /api/v1/interviews/sessions — see
// services/interviewService.ts) and routes to the live voice/video session
// for Voice/Text/Video modes, or straight to the coding editor for a Coding
// interview — the sessionId is threaded through so InterviewFeedback can
// pull the real scored report.
//
// "Target Role" and the duration pills are new here: the real backend
// contract requires `role` and `duration_min` on session creation, neither
// of which the old mock's on/off "Timed Interview" toggle collected.
const MockInterviewSetup = memo(() => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<MockInterviewSetupScreenNavigationProp>();
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['find', 'common']);
  const { subscription, isPro, isPremium } = React.useContext(AuthContext);

  const [mode, setMode] = React.useState<Practice_Mode_Enum>(
    route.params?.mode ?? Practice_Mode_Enum.Voice,
  );
  const [interviewType, setInterviewType] = React.useState<Interview_Type_Enum>(
    route.params?.interviewType ?? Interview_Type_Enum.Behavioral,
  );
  const [role, setRole] = React.useState(route.params?.role ?? '');
  const [difficulty, setDifficulty] = React.useState<Difficulty_Enum>(
    route.params?.difficulty ?? Difficulty_Enum.Intermediate,
  );
  const [durationMin, setDurationMin] = React.useState(route.params?.durationMin ?? 30);
  const [isStarting, setIsStarting] = React.useState(false);
  // AI Interview Laboratory (product request item) — "standard" (undefined
  // on the wire) means the original, no-persona interviewer tone; picking
  // one of the admin-configured personas below changes HOW the AI asks
  // questions, never what topic/type is being interviewed on. The catalog
  // itself (name/description/icon, already translated server-side for the
  // user's language — see content.py's get_public_config) comes from the
  // same app-launch config fetch every other feature flag/catalog in this
  // app reads, so there's no extra network call just for this picker.
  const [persona, setPersona] = React.useState<string | undefined>(undefined);
  const enabledPersonas = React.useMemo(
    () => configService.getCachedConfig().interview_personas.items.filter(p => p.enabled),
    [],
  );
  const showPersonaPicker =
    configService.isFeatureEnabled('interview_laboratory') && enabledPersonas.length > 0;
  // undefined/COMPANY_ANY both mean "no specific company" — kept as
  // undefined when threading through to the session config/navigation so
  // downstream screens only see a real company name or nothing.
  const [company, setCompany] = React.useState<string | undefined>(route.params?.company);
  const [companySearch, setCompanySearch] = React.useState('');
  // Free-tier session gating (see services/entitlementsService.ts) —
  // "Sessions capped on Free, Pro unlocks all". Loaded on mount/whenever
  // `subscription` changes purely to drive the remaining-sessions notice
  // below; onStart always re-checks fresh right before creating a session,
  // since this cached copy could be a session or two stale.
  const [remainingFreeSessions, setRemainingFreeSessions] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getSessionEntitlement(subscription).then(entitlement => {
      if (!cancelled) setRemainingFreeSessions(entitlement.isPro ? null : entitlement.remaining);
    });
    return () => {
      cancelled = true;
    };
  }, [subscription]);

  const filteredCompanies = React.useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const list = query
      ? DATA_COMPANIES.filter(name => name.toLowerCase().includes(query))
      : DATA_COMPANIES;
    return [...list, COMPANY_ANY];
  }, [companySearch]);

  // Video mode is gated to Pro Premium/Pro Yearly specifically (see
  // saveur-backend/app/api/interviews.py's create_session, which enforces
  // this same rule server-side) — a plain monthly Pro subscriber can use
  // Voice/Text/Coding but not Video.
  const onSelectMode = (selected: Practice_Mode_Enum) => {
    if (selected === Practice_Mode_Enum.Video && !isPremium) {
      Alert.alert(
        t('find:video_premium_gate_title', { defaultValue: 'Video is a Pro Premium feature' }),
        t('find:video_premium_gate_body', {
          defaultValue: 'Practicing on camera with video analysis needs Saveur Pro Premium or Pro (Yearly).',
        }),
        [
          { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('find:upgrade_to_pro', { defaultValue: 'Upgrade' }),
            onPress: () => navigate('Subscription'),
          },
        ],
      );
      return;
    }
    setMode(selected);
  };

  const onStart = async () => {
    if (isStarting) return;
    if (mode === Practice_Mode_Enum.Video && !isPremium) {
      Alert.alert(
        t('find:video_premium_gate_title', { defaultValue: 'Video is a Pro Premium feature' }),
        t('find:video_premium_gate_body', {
          defaultValue: 'Practicing on camera with video analysis needs Saveur Pro Premium or Pro (Yearly).',
        }),
        [
          { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
          {
            text: t('find:upgrade_to_pro', { defaultValue: 'Upgrade' }),
            onPress: () => navigate('Subscription'),
          },
        ],
      );
      return;
    }
    if (!role.trim()) {
      Alert.alert(
        t('find:target_role_required', { defaultValue: 'Target role required' }),
        t('find:target_role_required_description', {
          defaultValue: 'Let us know what role you’re practicing for so questions can be tailored to it.',
        }),
      );
      return;
    }
    setIsStarting(true);
    try {
      const entitlement = await getSessionEntitlement(subscription);
      if (!entitlement.canStart) {
        Alert.alert(
          t('find:free_limit_reached_title', { defaultValue: "You've used your free sessions" }),
          t('find:free_limit_reached_body', {
            limit: entitlement.sessionsLimit ?? 5,
            defaultValue: `Free plans include ${entitlement.sessionsLimit ?? 5} practice sessions a month. Upgrade to Pro for unlimited practice.`,
          }),
          [
            { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
            {
              text: t('find:upgrade_to_pro', { defaultValue: 'Upgrade to Pro' }),
              onPress: () => navigate('Subscription'),
            },
          ],
        );
        return;
      }
      const { sessionId, firstQuestion, firstQuestionId } = await interviewService.startSession({
        interviewType,
        mode,
        difficulty,
        role,
        company,
        durationMin,
        persona,
      });
      if (interviewType === Interview_Type_Enum.Coding) {
        navigate('CodingInterview', { sessionId, interviewType });
      } else {
        // BUG FIX (product report: "voice/video interview starts in
        // English, then later changes to the user's preferred language"):
        // startSession already returns the real, properly-translated first
        // question — this used to be silently discarded, so
        // LiveInterviewSession had nothing to show/speak until its first
        // adaptive follow-up fetch and fell back to its local, English-only
        // static question bank in the meantime. Threading it through here
        // is the actual fix — see navigation/types.tsx's own comment.
        navigate('LiveInterviewSession', {
          sessionId, interviewType, mode, company, durationMin,
          firstQuestion, firstQuestionId,
        });
      }
    } catch (e: any) {
      // llm_unavailable means the AI provider behind the interview (question
      // generation, avatar, etc.) is down/out of quota -- server no longer
      // sends the raw provider error text for this (see backend's
      // app/__init__.py _llm_unavailable handler), but this screen-specific
      // copy reads better here than the generic fallback message.
      const body = e?.error === 'llm_unavailable'
        ? t('find:interview_unavailable_body', {
            defaultValue: 'Video, voice, and text interviews are temporarily unavailable. Please try again later.',
          })
        : e?.message ?? t('common:something_went_wrong', {defaultValue: 'Something went wrong. Please try again.'});
      Alert.alert(
        t('find:start_interview_failed', { defaultValue: 'Could not start interview' }),
        body,
      );
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('find:mock_interview_setup')}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {!isPro && remainingFreeSessions !== null ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigate('Subscription')}
            // Redesign v2 (full reskin): `card` (spread by freeLimitBanner)
            // carries a real shadow again, which needs an opaque fill to
            // render correctly on Android — dropped the inline
            // 'transparent' override (this is a plain TouchableOpacity, no
            // `level` prop, so the fill lives on the style itself).
            style={styles.freeLimitBanner}>
            <Icon pack="eva" name="flash-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
            <Text category="h9-s" status={remainingFreeSessions > 0 ? 'basic' : 'danger'} style={globalStyle.flexOne} ml={8}>
              {remainingFreeSessions > 0
                ? t('find:free_sessions_remaining', {
                    defaultValue: `${remainingFreeSessions} free session${remainingFreeSessions === 1 ? '' : 's'} left this month`,
                    count: remainingFreeSessions,
                  })
                : t('find:free_sessions_used_up', { defaultValue: "You've used all your free sessions this month" })}
            </Text>
            <Text category="h10" status="link" bold>
              {t('find:upgrade_to_pro', { defaultValue: 'Upgrade' })}
            </Text>
          </TouchableOpacity>
        ) : null}

        <Text category="h8" bold status="placeholder" mb={16}>
          {t('find:choose_mode')}
        </Text>
        <Flex justify="flex-start" wrap mb={32}>
          {DATA_PRACTICE_MODES.map((item, i) => {
            const active = item.mode === mode;
            const locked = item.mode === Practice_Mode_Enum.Video && !isPremium;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => onSelectMode(item.mode)}
                style={[
                  styles.modeCard,
                  { borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                ]}>
                {locked ? (
                  <View style={[styles.lockBadge, { backgroundColor: theme['background-basic-color-3'] }]}>
                    <Icon pack="eva" name="lock-outline" style={[globalStyle.icon16, { tintColor: theme['text-placeholder-color'] }]} />
                  </View>
                ) : null}
                <Icon
                  pack="assets"
                  name={item.icon}
                  style={[globalStyle.icon24, { tintColor: active ? theme['color-primary-500'] : theme['text-placeholder-color'] }]}
                />
                <Text category="h8" bold mt={8} status={active ? 'link' : 'basic'}>
                  {getPracticeModeLabel(item.mode, t)}
                </Text>
                <Text category="h9-s" status="placeholder" mt={4} center>
                  {getPracticeModeDescription(item.mode, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <Text category="h8" bold status="placeholder" mb={16}>
          {t('find:interview_type')}
        </Text>
        <View style={styles.chipsWrap}>
          {DATA_INTERVIEW_TYPES.map((item, i) => {
            const active = item.type === interviewType;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setInterviewType(item.type)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {getInterviewTypeLabel(item.type, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text category="h8" bold status="placeholder" mt={32} mb={4}>
          {t('find:target_role', { defaultValue: 'Target Role' })}
        </Text>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('find:target_role_description', {
            defaultValue: 'What role are you interviewing for? Used to tailor your questions.',
          })}
        </Text>
        <Input
          placeholder={t('find:target_role_placeholder', { defaultValue: 'e.g. Software Engineer' })}
          value={role}
          onChangeText={setRole}
          style={styles.companySearchInput}
          textStyle={globalStyle.inputText}
        />

        <Text category="h8" bold status="placeholder" mt={16} mb={16}>
          {t('find:difficulty')}
        </Text>
        <Flex justify="flex-start" mb={32}>
          {DATA_DIFFICULTY.map((item, i) => {
            const active = item === difficulty;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setDifficulty(item)}
                style={[
                  styles.difficultyPill,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : 'transparent',
                    borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {getDifficultyLabel(item, t)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <Text category="h8" bold status="placeholder" mt={32} mb={4}>
          {t('find:company', { defaultValue: 'Company (optional)' })}
        </Text>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('find:company_description', {
            defaultValue: 'Get a company-flavored intro on your questions.',
          })}
        </Text>
        <Input
          placeholder={t('find:search_company', { defaultValue: 'Search companies…' })}
          value={companySearch}
          onChangeText={setCompanySearch}
          style={styles.companySearchInput}
          textStyle={globalStyle.inputText}
          accessoryLeft={props => <Icon {...props} pack="assets" name="search" />}
        />
        <View style={styles.chipsWrap}>
          {filteredCompanies.map((name, i) => {
            const active = name === COMPANY_ANY ? company === undefined : company === name;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setCompany(name === COMPANY_ANY ? undefined : name)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {showPersonaPicker ? (
          <>
            <Text category="h8" bold status="placeholder" mt={32} mb={4}>
              {t('find:interviewer_personality', { defaultValue: 'Interviewer Personality' })}
            </Text>
            <Text category="h9-s" status="placeholder" mb={16}>
              {t('find:interviewer_personality_description', {
                defaultValue: 'Practice against a specific interviewer style — the AI Interview Laboratory.',
              })}
            </Text>
            <View style={styles.personaGrid}>
              {enabledPersonas.map(p => {
                const active = persona === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    activeOpacity={0.7}
                    onPress={() => setPersona(active ? undefined : p.id)}
                    style={[
                      styles.personaCard,
                      { borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'] },
                    ]}>
                    <Icon
                      pack="eva"
                      name={p.icon || 'person-outline'}
                      style={[globalStyle.icon20, { tintColor: active ? theme['color-primary-500'] : theme['text-placeholder-color'] }]}
                    />
                    <Text category="h9" bold mt={6} status={active ? 'link' : 'basic'} center numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text category="h10" status="placeholder" mt={2} center numberOfLines={2}>
                      {p.description}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        <Text category="h8" bold status="placeholder" mt={32} mb={4}>
          {t('find:session_length', { defaultValue: 'Session Length' })}
        </Text>
        <Text category="h9-s" status="placeholder" mb={16}>
          {t('find:session_length_description', {
            defaultValue: 'How long should this interview run?',
          })}
        </Text>
        <Flex justify="flex-start" mb={40}>
          {DURATION_OPTIONS_MIN.map(min => {
            const active = min === durationMin;
            return (
              <TouchableOpacity
                key={min}
                activeOpacity={0.7}
                onPress={() => setDurationMin(min)}
                style={[
                  styles.difficultyPill,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : 'transparent',
                    borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'],
                  },
                ]}>
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {min} {t('find:minutes_unit', { defaultValue: 'min' })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Flex>

        <CtaButton
          children={isStarting ? t('find:starting', { defaultValue: 'Starting…' }) : t('find:start_interview')}
          onPress={onStart}
          disabled={isStarting}
          style={globalStyle.shadowBtn}
        />
      </Content>
    </Container>
  );
});

export default MockInterviewSetup;

const themedStyles = StyleService.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 80,
  },
  freeLimitBanner: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 24,
    backgroundColor: 'background-basic-color-2',
  },
  modeCard: {
    ...globalStyle.card,
    // Bug report ("box shadow... looking very bad on android", screenshot
    // of these exact 3 mode cards): `card` spreads Android's `elevation`
    // (see globalStyle.ts's own comment on this) which needs an OPAQUE
    // backgroundColor on the same View to render as a soft, correctly-
    // clipped shadow — without one, Android draws a heavy, hard-edged gray
    // block instead. This was a plain TouchableOpacity with no fill at all
    // (just a borderColor), so it hit exactly that bug.
    backgroundColor: 'background-basic-color-1',
    // Follow-up bug report ("the box shadow of the interview type is not
    // looking nice, make it look moderate"): globalStyle.card's shared iOS
    // shadow (shadowOpacity 0.3, shadowRadius 10, offset height 6) reads as
    // a heavy drop shadow on these three small, already-bordered
    // (borderWidth 2) side-by-side cards specifically — toned down locally
    // here rather than in globalStyle.card itself, which ~60+ other files
    // across the app share and were already deliberately tuned. Android
    // still gets zero shadow either way (globalStyle.ts's cardShadow has no
    // `elevation` in its android branch at all, per the earlier "remove box
    // shadow on Android" request), so this override only affects iOS.
    ...Platform.select({
      ios: {
        shadowOpacity: 0.12,
        shadowRadius: 6.0,
        shadowOffset: {width: 0, height: 3},
      },
      default: {},
    }),
    width: '31%',
    borderWidth: 2,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginRight: '2%',
    marginBottom: 12,
    position: 'relative',
  },
  personaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  personaCard: {
    width: '48%',
    borderWidth: 2,
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
    backgroundColor: 'background-basic-color-1',
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  companySearchInput: {
    ...globalStyle.inputField,
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    marginRight: 8,
    marginBottom: 8,
  },
  difficultyPill: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
    borderWidth: 1,
    marginRight: 12,
  },
});
