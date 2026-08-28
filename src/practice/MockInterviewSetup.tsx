import React, { memo } from 'react';
import { Alert, View, TouchableOpacity } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Icon,
  Button,
  Input,
  Spinner,
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
import { DATA_PRACTICE_MODES, DATA_INTERVIEW_TYPES, DATA_DIFFICULTY, DATA_COMPANIES, COMPANY_ANY, companiesForCountries } from 'constants/Data';
import { Difficulty_Enum, Interview_Type_Enum, Practice_Mode_Enum } from 'constants/Types';
import * as interviewService from 'services/interviewService';
import * as configService from 'services/configService';
import { getSessionEntitlement, hasAddon, addonCodeForInterviewType } from 'services/entitlementsService';
import { getInterviewTypeLabel, getPracticeModeLabel, getPracticeModeDescription, getDifficultyLabel } from 'utils/interviewTypeLabels';
import { AuthContext } from '../../AuthContext';
import CtaButton from 'components/CtaButton';
import PersonaDetailModal from 'components/PersonaDetailModal';
import LockBadge from 'components/LockBadge';
import CompanyLogoAvatar from 'components/CompanyLogoAvatar';
import { guessCompanyLogoUrl } from 'utils/companyLogo';
import { searchCompany, CompanySearchResult } from 'services/companySearchService';
import { InterviewPersona } from 'services/configService';

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
  const { subscription, isPro, isPremium, profile } = React.useContext(AuthContext);

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
  // BUG FIX (product report: "when I change from one language to another,
  // some parts of the app still display in the former language"): this
  // memo's empty dep array meant the persona name/description text --
  // already translated server-side per-language, see the comment above --
  // was computed ONCE at this screen's first mount and then frozen for the
  // rest of its lifetime, even after configService.loadAppConfig() re-fetches
  // a freshly-translated catalog on a mid-session language switch (see
  // i18n/config.ts's 'languageChanged' listener). forceRerender + the
  // subscribe() below is the same fix already used by FaqScreen/AboutScreen/
  // AnnouncementBanner/DailyChallengeCard for this exact class of bug --
  // it just forces this component to re-render (and this memo to
  // re-derive) when the cache actually refreshes, instead of only picking
  // up new text on a future unmount/remount.
  const [, forceRerender] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => configService.subscribe(forceRerender), []);
  const enabledPersonas = React.useMemo(
    () => configService.getCachedConfig().interview_personas.items.filter(p => p.enabled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configService.getCachedConfig()],
  );
  // Product correction: "The interviewer personality feature should be a
  // pro premium plan not pro plan" — this used to only check the admin
  // feature flag + catalog, with no subscription-tier gate at all (visible
  // to free and Pro users alike). `isPremium` (this file already uses the
  // same flag to lock Video practice mode below) restricts it to Pro
  // Premium only, matching the plan-tier breakdown given for this app's
  // Free/Pro/Pro Premium feature audit.
  const showPersonaPicker =
    configService.isFeatureEnabled('interview_laboratory') && enabledPersonas.length > 0 && isPremium;
  // Product request item: "A pop up with more detail on the interviewer
  // personality when they click on it" — see PersonaDetailModal's own doc
  // comment for the full story (it renders `style`, which was already
  // being shipped to mobile in this same config payload but never shown
  // anywhere before this).
  const [detailPersona, setDetailPersona] = React.useState<InterviewPersona | null>(null);
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

  // BUG FIX (same product report as onStart's addon-ordering fix above):
  // the free-session banner below used to render off of remainingFreeSessions
  // alone, with no regard for whether the CURRENTLY selected interviewType is
  // even drawn from that pool. For Coding once its coding_practice add-on is
  // owned, it isn't -- so showing "You've used all your free sessions this
  // month" while Coding is selected was actively misleading (that pool being
  // empty has no bearing on Coding anymore). Tracks ownership for whichever
  // type is currently selected so the banner can hide itself in that case.
  const [selectedTypeAddonOwned, setSelectedTypeAddonOwned] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const requiredAddon = addonCodeForInterviewType(interviewType);
    if (!requiredAddon) {
      setSelectedTypeAddonOwned(false);
      return;
    }
    hasAddon(requiredAddon).then(owned => {
      if (!cancelled) setSelectedTypeAddonOwned(owned);
    });
    return () => {
      cancelled = true;
    };
  }, [interviewType]);

  // Product report: "the company list in the interview setup is very
  // US-centric" — regionCompanies puts the user's own regional employers
  // (from their signup/JobPreferences preferredCountries) ahead of the
  // rest of the global DATA_COMPANIES list, rather than showing the same
  // US Big Tech-heavy list to everyone regardless of where they are. See
  // constants/Data.ts's companiesForCountries for the region mapping.
  const regionCompanies = React.useMemo(
    () => companiesForCountries(profile?.preferredCountries),
    [profile?.preferredCountries],
  );

  // AI web search fallback (product request: "when users type the company
  // and it's not part of the list already listed there the AI should
  // search the web for that company and its logo and then the user can
  // select it... the app should ask 'is this the company you are looking
  // for?'"). customCompanies holds AI-confirmed companies added this
  // session so they render as a normal selectable chip (with the real,
  // verified logo from the search) right alongside the app's own curated
  // list, same as if they'd been there all along. customCompanyLogos maps
  // a custom company's name to its verified logoUrl, checked ahead of
  // guessCompanyLogoUrl's heuristic when rendering any chip below.
  const [customCompanies, setCustomCompanies] = React.useState<CompanySearchResult[]>([]);
  const customCompanyLogos = React.useMemo(() => {
    const map: Record<string, string> = {};
    customCompanies.forEach(c => {
      if (c.logoUrl) map[c.name.toLowerCase()] = c.logoUrl;
    });
    return map;
  }, [customCompanies]);

  type AiCompanySearchState = 'idle' | 'searching' | 'confirming' | 'not_found';
  const [aiSearchState, setAiSearchState] = React.useState<AiCompanySearchState>('idle');
  const [aiSearchResult, setAiSearchResult] = React.useState<CompanySearchResult | null>(null);
  // Any edit to the search box invalidates whatever the AI search last
  // found/confirmed for a DIFFERENT query — otherwise a stale "Is this the
  // company you're looking for?" card (or "check the spelling" message)
  // from a previous search could linger on screen while the user types a
  // new one.
  React.useEffect(() => {
    setAiSearchState('idle');
    setAiSearchResult(null);
  }, [companySearch]);

  const filteredCompanies = React.useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const combined = [
      ...regionCompanies,
      ...customCompanies
        .map(c => c.name)
        .filter(name => !regionCompanies.some(r => r.toLowerCase() === name.toLowerCase())),
    ];
    const list = query
      ? combined.filter(name => name.toLowerCase().includes(query))
      : combined;
    return [...list, COMPANY_ANY];
  }, [companySearch, regionCompanies, customCompanies]);

  // Nothing in the app's own list (region-ranked catalog + anything
  // already AI-confirmed this session) matches what's typed — the trigger
  // for offering the AI web-search fallback below instead of leaving the
  // user stuck with only the generic "Other / Any Company" pill.
  const hasNoLocalMatch = companySearch.trim().length > 0
    && filteredCompanies.every(name => name === COMPANY_ANY);

  const onSearchCompanyOnline = async () => {
    const query = companySearch.trim();
    if (!query || aiSearchState === 'searching') return;
    setAiSearchState('searching');
    const result = await searchCompany(query);
    if (result) {
      setAiSearchResult(result);
      setAiSearchState('confirming');
    } else {
      setAiSearchResult(null);
      setAiSearchState('not_found');
    }
  };

  const onConfirmAiCompanyYes = () => {
    if (!aiSearchResult) return;
    setCustomCompanies(prev =>
      prev.some(c => c.name.toLowerCase() === aiSearchResult.name.toLowerCase())
        ? prev
        : [...prev, aiSearchResult],
    );
    setCompany(aiSearchResult.name);
    setCompanySearch('');
    setAiSearchState('idle');
    setAiSearchResult(null);
  };

  const onConfirmAiCompanyNo = () => {
    // Product spec: "if the user picks no then a new app should tell the
    // user to check the name and spelling well or search again" — reusing
    // the same not_found state/message as a search that found nothing at
    // all, since the corrective action (fix the spelling, try again) is
    // identical either way.
    setAiSearchResult(null);
    setAiSearchState('not_found');
  };

  // Video mode is gated to Pro Premium/Pro Yearly specifically (see
  // saveur-backend/app/api/interviews.py's create_session, which enforces
  // this same rule server-side) — a plain monthly Pro subscriber can use
  // Voice/Text/Coding but not Video.
  const onSelectMode = (selected: Practice_Mode_Enum) => {
    if (selected === Practice_Mode_Enum.Video && !isPremium) {
      Alert.alert(
        t('find:video_premium_gate_title', { defaultValue: 'Video is a Premium feature' }),
        t('find:video_premium_gate_body', {
          defaultValue: 'Practicing on camera with video analysis needs Saveur Premium or Premium (Yearly).',
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
        t('find:video_premium_gate_title', { defaultValue: 'Video is a Premium feature' }),
        t('find:video_premium_gate_body', {
          defaultValue: 'Practicing on camera with video analysis needs Saveur Premium or Premium (Yearly).',
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
      // Paid Add-on gate (product request: "for the coding practice ... I
      // want them to be in a separate screen called add-ons and they
      // should be paid for") — same mapping/pattern as FindScreen.tsx's
      // Tools-tile shortcuts. Only Coding is gated now — System Design was
      // un-gated once its paid feature (the drawing canvas) was removed,
      // see entitlementsService.ts's addonCodeForInterviewType comment.
      // Every other interviewType is unaffected either way (returns null).
      //
      // BUG FIX (product report: "the 3 practice session is still
      // displaying even when no free session left in that month for the
      // user") — this addon check used to run AFTER the free-session-cap
      // check below, so a user who already paid for the coding_practice
      // add-on still got blocked by "you've used your free sessions" once
      // their shared monthly pool ran out, even though the add-on is
      // supposed to unlock Coding for good, independent of that pool (see
      // Saveur-Backend's app/api/interviews.py create_session() — same
      // reordering applied there). Now checked FIRST, and an owned add-on
      // skips the free-session-cap check entirely instead of still needing
      // headroom in that pool on top of it.
      const requiredAddon = addonCodeForInterviewType(interviewType);
      const addonOwned = requiredAddon ? await hasAddon(requiredAddon) : false;
      if (requiredAddon && !addonOwned) {
        Alert.alert(
          t('find:addon_required_title_generic', { defaultValue: 'This is a paid add-on' }),
          t('find:addon_required_body', {
            defaultValue: 'Purchase the add-on once to unlock it for good.',
          }),
          [
            { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
            {
              text: t('more:addons_title', { defaultValue: 'Add-ons' }),
              onPress: () => navigate('AddOns', { highlightCode: requiredAddon }),
            },
          ],
        );
        return;
      }

      if (!addonOwned) {
        const entitlement = await getSessionEntitlement(subscription);
        if (!entitlement.canStart) {
          Alert.alert(
            t('find:free_limit_reached_title', { defaultValue: "You've used your free sessions" }),
            t('find:free_limit_reached_body', {
              limit: entitlement.sessionsLimit ?? 5,
              defaultValue: `Free plans include ${entitlement.sessionsLimit ?? 5} practice sessions a month. Upgrade to Basic for unlimited practice.`,
            }),
            [
              { text: t('common:cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
              {
                text: t('find:upgrade_to_pro', { defaultValue: 'Upgrade to Basic' }),
                onPress: () => navigate('Subscription'),
              },
            ],
          );
          return;
        }
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
        navigate('CodingInterview', { sessionId, interviewType, durationMin });
      } else {
        // Product report: "the system design practice is different from the
        // system design interview so you need to separate that" / "the AI
        // interviewer can ask the user to create some design in the
        // whiteboard as part of the interview questions." System Design
        // picked here now goes through the SAME real Q&A interview flow as
        // every other type (LiveInterviewSession) instead of jumping
        // straight to the blank whiteboard with no interviewer — the
        // backend (interviews.py's _generate_question) decides on its own,
        // partway through the Q&A, when to hand the candidate off to the
        // whiteboard, and LiveInterviewSession is what watches for that
        // signal and navigates there itself, carrying the countdown timer
        // with it (see that screen's requires_whiteboard handling). The old
        // "jump straight to a blank whiteboard, no interviewer" behavior
        // still exists — it's now FindScreen's Tools > System Design tile,
        // which starts a "system_design_practice" session instead of
        // "system_design".
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
        {!isPro && remainingFreeSessions !== null && !selectedTypeAddonOwned ? (
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

        {/* Product report: "when user select coding as the type of
            interview then the interview modes (voice, text, video) cards
            dont need to show" — Coding routes straight to its own dedicated
            screen (onStart above), never to LiveInterviewSession, so `mode`
            is entirely unused for it; showing the picker anyway just
            invited a meaningless choice. System Design USED to be lumped in
            here too, but now goes through the real voice/text/video Q&A
            flow like every other type (see onStart's comment), so it needs
            this picker same as they do. */}
        {interviewType !== Interview_Type_Enum.Coding ? (
          <>
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
                {locked ? <LockBadge /> : null}
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
          </>
        ) : null}

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
                    borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'],
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
          accessoryLeft={props => (
            <Icon {...props} style={[props.style, styles.accessoryLeftSpacing]} pack="assets" name="search" />
          )}
        />
        <View style={styles.chipsWrap}>
          {filteredCompanies.map((name, i) => {
            const active = name === COMPANY_ANY ? company === undefined : company === name;
            const isRealCompany = name !== COMPANY_ANY;
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.7}
                onPress={() => setCompany(name === COMPANY_ANY ? undefined : name)}
                style={[
                  styles.chip,
                  isRealCompany && styles.chipWithLogo,
                  {
                    backgroundColor: active ? theme['color-primary-500'] : theme['background-basic-color-2'],
                    borderColor: active ? theme['color-primary-500'] : theme['background-basic-color-3'],
                  },
                ]}>
                {/* Product report: "in the company list in the interview
                    mock setup screen, you should also display the logos
                    of these company too" — skipped for the "Other / Any
                    Company" pill, which isn't a real company. */}
                {isRealCompany ? (
                  <CompanyLogoAvatar
                    logoUrl={customCompanyLogos[name.toLowerCase()] ?? guessCompanyLogoUrl(name)}
                    companyName={name}
                    size="tiny"
                    style={{ marginRight: 6 }}
                  />
                ) : null}
                <Text category="h9" bold status={active ? 'control' : 'basic'}>
                  {name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* AI web search fallback (product request: "when users type the
            company and it's not part of the list already listed there the
            AI should search the web for that company and its logo and then
            the user can select it... We should not limit the user to the
            few ones the app listed"). Only offered once nothing in the
            app's own list matches what's typed — a real match should
            always just be picked from the chips above. */}
        {hasNoLocalMatch ? (
          <View style={styles.aiCompanySearchBlock}>
            {aiSearchState === 'confirming' && aiSearchResult ? (
              <View style={styles.aiCompanyCard}>
                <Flex itemsCenter mb={12}>
                  <CompanyLogoAvatar
                    logoUrl={aiSearchResult.logoUrl}
                    companyName={aiSearchResult.name}
                    size="small"
                    style={{ marginRight: 10 }}
                  />
                  <Text category="h8" bold style={globalStyle.flexOne}>
                    {aiSearchResult.name}
                  </Text>
                </Flex>
                <Text category="h9-s" status="placeholder" mb={14}>
                  {t('find:ai_company_confirm_question', {
                    defaultValue: 'Is this the company you’re looking for?',
                  })}
                </Text>
                <Flex>
                  <Button
                    size="small"
                    status="primary"
                    style={[globalStyle.flexOne, { marginRight: 8 }]}
                    onPress={onConfirmAiCompanyYes}>
                    {t('common:yes', { defaultValue: 'Yes' })}
                  </Button>
                  <Button
                    size="small"
                    status="basic"
                    appearance="outline"
                    style={globalStyle.flexOne}
                    onPress={onConfirmAiCompanyNo}>
                    {t('common:no', { defaultValue: 'No' })}
                  </Button>
                </Flex>
              </View>
            ) : aiSearchState === 'not_found' ? (
              <Text category="h9-s" status="danger" mt={4}>
                {t('find:ai_company_not_found', {
                  defaultValue: "Couldn't confirm that company — check the name and spelling, or try searching again.",
                })}
              </Text>
            ) : (
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={aiSearchState === 'searching'}
                onPress={onSearchCompanyOnline}
                style={[styles.aiCompanySearchRow, { borderColor: theme['background-basic-color-3'] }]}>
                {aiSearchState === 'searching' ? (
                  <Spinner size="small" status="basic" />
                ) : (
                  <Icon pack="eva" name="globe-2-outline" style={[globalStyle.icon20, { tintColor: theme['color-primary-500'] }]} />
                )}
                <Text category="h9" bold status="primary" ml={8}>
                  {aiSearchState === 'searching'
                    ? t('find:ai_company_searching', { defaultValue: 'Searching the web…' })
                    : t('find:ai_company_search_cta', {
                        defaultValue: 'Search the web for "{{query}}"',
                        query: companySearch.trim(),
                      })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

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
                    {/* Separate tap target from the card itself (which
                        selects/deselects on tap) — opens PersonaDetailModal
                        instead of toggling selection. hitSlop makes this
                        comfortably tappable despite the small icon. */}
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => setDetailPersona(p)}
                      style={styles.personaInfoButton}>
                      <Icon
                        pack="eva"
                        name="info-outline"
                        style={[globalStyle.icon16, { tintColor: theme['text-placeholder-color'] }]}
                      />
                    </TouchableOpacity>
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

      <PersonaDetailModal
        persona={detailPersona}
        isSelected={!!detailPersona && persona === detailPersona.id}
        onClose={() => setDetailPersona(null)}
        onSelect={() => {
          if (!detailPersona) return;
          setPersona(persona === detailPersona.id ? undefined : detailPersona.id);
        }}
      />
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
    // Product request ("remove box shadows from every card in the app"):
    // globalStyle.card's own shadow is now zeroed out everywhere (see
    // globalStyle.ts), so the local iOS-only "make it moderate" tuning
    // this used to carry (shadowOpacity/shadowRadius/shadowOffset) would
    // have re-introduced a shadow globalStyle.card no longer has —
    // removed rather than tuned further. The borderWidth 2 below still
    // gives these three cards a visible edge with no shadow at all.
    width: '31%',
    borderWidth: 2,
    // Google-style furnishing pass (see styles/globalStyle.ts's `card`) --
    // 14 -> 20.
    borderRadius: 16,
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
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
    backgroundColor: 'background-basic-color-1',
    position: 'relative',
  },
  personaInfoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  companySearchInput: {
    ...globalStyle.inputField,
    marginBottom: 12,
  },
  // Same fix as ApplicationsTab.tsx's own searchInput (bug report: "the
  // search icon is touching the edge of the input field") — see that
  // file's comment. Only applies to the company-search Input above (the
  // one with accessoryLeft); the plain Target Role Input reuses
  // companySearchInput too but has no icon, so this is harmless there.
  accessoryLeftSpacing: {
    marginLeft: 14,
  },
  // Product report: "did you remove the border from some of the button
  // pills in Mock Interview Setup? People might not know that they are
  // buttons" — this style never had a borderWidth (it's been background-
  // color-only since it was first added), unlike every other pill/card on
  // this screen (modeCard, personaCard, difficultyPill, the duration
  // pills all carry a real border in both their active and inactive
  // states). Used by the Interview Type row and the Company row — both
  // now get the same borderWidth 1 + a per-state borderColor (brand blue
  // when selected, the same neutral background-basic-color-3 outline
  // difficultyPill uses when not) at their call sites, so an unselected
  // chip reads as a real tappable pill instead of a plain gray label.
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  // Company chips only (product report: "display the logos of these
  // company too") — `chip` above has no flexDirection, so a plain View's
  // children stack vertically by default; this lays the logo avatar and
  // name out side by side instead.
  chipWithLogo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiCompanySearchBlock: {
    marginTop: 4,
  },
  aiCompanySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  // FULL RESKIN: dropped the leftover borderWidth: 1 hairline (and its
  // inline borderColor override at the call site) — globalStyle.card
  // already carries the new shadow, a border on top of that was the old
  // pre-reskin card look doubled up with the new one.
  aiCompanyCard: {
    ...globalStyle.card,
    padding: 16,
  },
  difficultyPill: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 99,
    borderWidth: 1,
    marginRight: 12,
  },
});
