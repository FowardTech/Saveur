import React, { memo } from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Button,
  Input,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

import Text from 'components/Text';
import { SkeletonBlock } from 'components/Skeleton';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { RootStackParamList } from 'navigation/types';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import { ArtRoadmapPath } from 'src/home/HomeHeroArt';
import * as roadmapService from 'services/roadmapService';
import { CareerRoadmap as CareerRoadmapPlan, RoadmapStep, RoadmapStepType } from 'services/roadmapService';
import CtaButton from 'components/CtaButton';
import CircularProgress from 'components/CircularProgress';
import StatMiniCard from 'components/StatMiniCard';
import * as gamificationService from 'services/gamificationService';
import { GamificationStreakProps } from 'constants/Types';

// HOME REDESIGN follow-through (product ask: "use this look and feel
// throughout the whole app" -- this screen is the direct target of
// screenshot 2, "My Roadmap": donut-ring + 2x2 stat header, card-row
// timeline, and a "Milestone Overview" grid). Same "no fabricated data"
// rule as HomeSrc.tsx's MissionHeroCard -- the reference's "Week 1-4"
// milestone buckets don't exist in Saveur's real data (RoadmapStep has no
// week/day field), so this groups by the real RoadmapStepType instead and
// reports actual completed/total counts per type.
const TYPE_META: Record<RoadmapStepType, { label: string; icon: string; bg: string; tint: string }> = {
  skill: { label: 'Skills', icon: 'book-outline', bg: '#ECFDF5', tint: '#059669' },
  project: { label: 'Projects', icon: 'briefcase-outline', bg: '#E8F0FF', tint: '#0052D9' },
  interview: { label: 'Interviews', icon: 'mic-outline', bg: '#F5EFFF', tint: '#7C3AED' },
  milestone: { label: 'Milestones', icon: 'flag-outline', bg: '#FFF3E0', tint: '#B45309' },
};

// AI Career Roadmap — product request item #15 (⭐⭐⭐⭐⭐): "I want to
// become a Senior Backend Engineer" -> the AI plans a linear sequence of
// real-world milestones from today to landing that role (Learn Docker ->
// Learn Kubernetes -> Learn AWS -> System Design -> Senior Interview ->
// Promotion), rendered as a vertical flow and tracked step by step. See
// services/roadmapService.ts and app/api/career_roadmap.py.
const ICONS_BY_TYPE: Record<RoadmapStepType, string> = {
  skill: 'book-outline',
  project: 'briefcase-outline',
  interview: 'mic-outline',
  milestone: 'flag-outline',
};

const CareerRoadmap = memo(() => {
  const theme = useTheme();
  const styles = useStyleSheet(themedStyles);
  const { t } = useTranslation(['more', 'common']);
  const { isPremium } = React.useContext(AuthContext);
  // Optional prefill from src/more/NextStepRecommendation.tsx's "Build my
  // AI Career Roadmap" CTA (product request: post-graduation "next step
  // career plan recommendation") -- mirrors WhatsNext.tsx's own
  // route.params?.company/role prefill pattern. Only ever pre-fills the
  // form; a user who already has a saved roadmap still just sees it
  // normally, same as reaching this screen any other way.
  const route = useRoute<RouteProp<RootStackParamList, 'CareerRoadmap'>>();

  const [targetRole, setTargetRole] = React.useState(route.params?.targetRole ?? '');
  const [currentRole, setCurrentRole] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  // Product ask: "all forms in the dashboard should be bottom sheets" —
  // this one was still rendered inline in the content flow (see this
  // block's own git history). Same Modal/backdrop/sheet idiom as
  // components/DocumentPickerModal.tsx and Chat.tsx's topicsSheet: the
  // main screen now just shows the illustration/description + a CTA, and
  // this form only exists inside the sheet that CTA opens.
  const [formSheetVisible, setFormSheetVisible] = React.useState(false);
  const [roadmap, setRoadmap] = React.useState<CareerRoadmapPlan | null>(null);
  const [roadmapLoaded, setRoadmapLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Which step's "Mark complete" call is currently in flight — disables
  // just that button (not the whole screen) and swaps its label for a
  // spinner while the request is out.
  const [completingOrder, setCompletingOrder] = React.useState<number | null>(null);

  // Streak -- feeds the new stats-header card's "Streak" tile (see
  // HomeSrc.tsx's own identical fetch/comment for the "why an independent
  // duplicate fetch" rationale; same GET /api/v1/gamification/streak,
  // same fail-open/non-critical handling).
  const [streak, setStreak] = React.useState<GamificationStreakProps | null>(null);
  React.useEffect(() => {
    if (!isPremium) return;
    gamificationService.getStreak().then(setStreak).catch(() => {
      // Non-critical -- the stats card just falls back to 0 days.
    });
  }, [isPremium]);

  const loadRoadmap = React.useCallback(() => {
    // BUG FIX (product report: "The AI roadmap is a premium plan but users
    // are accessing it when they click on it from the notification center
    // or trail... Features that are pro and pro premium should not be
    // accessible just from the notification tile or center when they did
    // not subscribe to the plan that has that feature") -- a non-Premium
    // user reaching this screen (Home's Roadmap pill, a push/in-app
    // notification tap, the AI Coach's suggested action, etc.) never needs
    // to fetch at all now that the whole screen is Premium-gated below;
    // skip the network round-trip entirely and just mark the (empty) load
    // as done so the paywall renders immediately instead of a skeleton
    // flash first.
    if (!isPremium) {
      setRoadmapLoaded(true);
      return;
    }
    roadmapService.getSavedRoadmap()
      .then(setRoadmap)
      .finally(() => setRoadmapLoaded(true));
  }, [isPremium]);

  React.useEffect(() => {
    loadRoadmap();
  }, [loadRoadmap]);

  // BUG FIX (pre-launch i18n staleness audit): GET /api/v1/roadmap already
  // translates saved steps on read whenever the caller's current language
  // differs from whatever language the roadmap was originally generated in
  // (see career_roadmap.py's get_roadmap docstring) — but this screen only
  // ever called it once at mount, so a mid-session language switch never
  // triggered the re-fetch needed to actually see that translation.
  React.useEffect(() => {
    i18n.on('languageChanged', loadRoadmap);
    return () => {
      i18n.off('languageChanged', loadRoadmap);
    };
  }, [loadRoadmap]);

  const onGenerate = async () => {
    const role = targetRole.trim();
    if (!role || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const plan = await roadmapService.generateRoadmap(role, currentRole.trim());
      setRoadmap(plan);
      setFormSheetVisible(false);
    } catch {
      setError(t('more:roadmap_generate_failed', {
        defaultValue: "Couldn't build your roadmap right now. Please try again.",
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const onReset = async () => {
    await roadmapService.resetRoadmap();
    setRoadmap(null);
    setTargetRole('');
    setCurrentRole('');
    setError(null);
  };

  const onCompleteStep = async (order: number) => {
    if (completingOrder != null) return;
    setCompletingOrder(order);
    setError(null);
    try {
      const updated = await roadmapService.completeStep(order);
      setRoadmap(updated);
    } catch {
      setError(t('more:roadmap_complete_step_failed', {
        defaultValue: "Couldn't update your roadmap right now. Please try again.",
      }));
    } finally {
      setCompletingOrder(null);
    }
  };

  const statusColor = (status: RoadmapStep['status']) => {
    if (status === 'completed') return theme['color-success-500'];
    if (status === 'current') return theme['color-primary-500'];
    return theme['text-hint-color'];
  };

  // Real completion percent (same computation Home's Roadmap Progress
  // stat card and MyProgress.tsx's own roadmap ring already use) and the
  // one "current" step, if any -- feed the new stats-header card below.
  const roadmapPercent = roadmap && roadmap.totalCount > 0
    ? Math.round((roadmap.completedCount / roadmap.totalCount) * 100)
    : 0;
  const currentStep = roadmap?.steps.find(s => s.status === 'current') ?? null;

  // Milestone Overview -- real counts per RoadmapStepType (see TYPE_META
  // above for why this replaces the reference's fabricated "Week 1-4"
  // buckets), paired up two-per-row for the grid, and skipping any type
  // that doesn't actually appear in this roadmap rather than rendering an
  // empty "0 of 0" tile for it.
  const milestoneGroups = React.useMemo(() => {
    if (!roadmap) return [];
    const counts = {} as Record<RoadmapStepType, { total: number; completed: number }>;
    roadmap.steps.forEach(step => {
      if (!counts[step.type]) counts[step.type] = { total: 0, completed: 0 };
      counts[step.type].total += 1;
      if (step.status === 'completed') counts[step.type].completed += 1;
    });
    return (Object.keys(counts) as RoadmapStepType[]).map(type => ({ type, ...counts[type] }));
  }, [roadmap]);

  const milestonePairs = React.useMemo(() => {
    const pairs: (typeof milestoneGroups)[] = [];
    for (let i = 0; i < milestoneGroups.length; i += 2) pairs.push(milestoneGroups.slice(i, i + 2));
    return pairs;
  }, [milestoneGroups]);

  // BUG FIX (product report: "The AI roadmap is a premium plan but users
  // are accessing it when they click on it from the notification center or
  // trail. That's wrong... Features that are pro and pro premium should not
  // be accessible just from the notification tile or center when they did
  // not subscribe to the plan that has that feature") -- a PRIOR version of
  // this screen only Pro-Premium-gated the manual "build one yourself" flow,
  // letting any free user who already had an orientation roadmap
  // auto-generated for them at signup (see
  // app/services/career_roadmap_service.py's ensure_auto_roadmap) view and
  // fully interact with it (mark steps complete, etc.) -- reachable from
  // Home's Roadmap pill, a push/in-app notification tap, or the AI Coach's
  // suggested action, same as every other entry point. Product decision now
  // is that Roadmap is a Premium feature full stop: even that free
  // auto-generated one is gated behind isPremium below, matching
  // entitlements_service.py's require_premium on GET/complete-step/reset
  // (see career_roadmap.py's own module docstring). isPremium is checked
  // first, ahead of the loading-skeleton branch, so a non-Premium user never
  // even sees a loading flash before the paywall.
  if (!isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:career_roadmap', { defaultValue: 'AI Career Roadmap' })}
        description={t('more:career_roadmap_pro_gate_description', {
          defaultValue: 'Tell the AI the role you want and it plans the real, step-by-step path to get there — a Premium feature.',
        })}
      />
    );
  }

  if (!roadmapLoaded) {
    // Product request: "I want skeleton loader in app" — was a bare
    // centered Spinner; a timeline-shaped placeholder (same dot/line/
    // content columns the real roadmap steps use below) previews the
    // eventual layout instead of just signaling "something is happening"
    // with no shape to it.
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('more:career_roadmap', { defaultValue: 'AI Career Roadmap' })}
          accessoryLeft={<NavigationAction />}
        />
        <Content contentContainerStyle={{ padding: 24 }}>
          <View style={styles.timeline}>
            {[0, 1, 2].map(i => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.timelineIndicatorCol}>
                  <SkeletonBlock style={{ width: 32, height: 32 }} radius={16} />
                  {i < 2 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={[styles.timelineContent, { paddingBottom: i < 2 ? 24 : 0 }]}>
                  <SkeletonBlock style={{ width: '70%', height: 14, marginBottom: 8 }} radius={4} />
                  <SkeletonBlock style={{ width: '90%', height: 11 }} radius={4} />
                </View>
              </View>
            ))}
          </View>
        </Content>
      </Container>
    );
  }

  // The old second gate that used to live here (`!roadmap && !isPremium`)
  // is now redundant -- the isPremium check above already returns before
  // this point for any non-Premium user, roadmap or not.

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:career_roadmap', { defaultValue: 'AI Career Roadmap' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        {/* Product request: "add illustrations like the gift box wherever
            needed" — this intro had no icon at all before, just text
            straight into the form. Only shown before a roadmap exists —
            once one's been generated, the timeline itself is the visual
            content, so a redundant illustration would take up space for no
            reason. See src/home/HomeHeroArt.tsx's own comment for the full
            sweep. */}
        {!roadmap ? (
          <Flex center mb={20}>
            <ArtRoadmapPath size={100} />
          </Flex>
        ) : null}
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:career_roadmap_description', {
            defaultValue: 'Tell the AI the role you want, and it plans the real path to get there — skills to learn, things to build, and the interview that lands it.',
          })}
        </Text>

        {error ? <Text category="h9-s" status="danger" mb={16} center>{error}</Text> : null}

        {roadmapLoaded && !roadmap ? (
          <CtaButton
            style={globalStyle.shadowBtn}
            onPress={() => setFormSheetVisible(true)}
          >
            {t('more:roadmap_build_cta', { defaultValue: 'Plan my roadmap' })}
          </CtaButton>
        ) : null}

        {roadmap ? (
          <View>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text category="h10" status="placeholder">
                  {t('more:roadmap_goal_label', { defaultValue: 'Goal' })}
                </Text>
                <Text category="h7" bold mt={2}>{roadmap.targetRole}</Text>
                {roadmap.autoGenerated ? (
                  <Text category="h10" status="placeholder" mt={2}>
                    {t('more:roadmap_auto_generated_note', {
                      defaultValue: 'Built from what you told us when you signed up.',
                    })}
                  </Text>
                ) : null}
              </View>
              <Text category="h10" status="link" onPress={onReset}>
                {t('more:curriculum_start_over', { defaultValue: 'Start over' })}
              </Text>
            </View>

            {/* HOME REDESIGN follow-through — reference screenshot 2's donut
                + 2x2 stat-grid header. Real fields only: current step order,
                completed/total steps, streak days, total steps — no
                fabricated "Day X of 30" (Saveur's roadmaps are variable-
                length, not a fixed 30-day program). */}
            <View style={styles.statsCard}>
              <CircularProgress
                progress={roadmapPercent}
                size={84}
                strokeWidth={8}
                trackColor={theme['background-basic-color-3']}
                gradientFrom="#1F7BFF"
                gradientTo="#0052D9"
                style={styles.statsRing}>
                <Text category="h7" bold>{roadmapPercent}%</Text>
                {/* Product report: "reduce the font size of the complete
                    text its touching the round progress bar" -- h10 (14px,
                    already this app's smallest heading step) still didn't
                    leave enough room inside the 84px ring alongside the
                    "29%" line above it. Explicit fontSize={10}/lineHeight
                    override (Text.tsx supports both) rather than a new,
                    smaller category just for this one label. */}
                <Text category="h10" status="placeholder" fontSize={10} lineHeight={12} mt={1}>
                  {t('more:roadmap_complete_label', { defaultValue: 'Complete' })}
                </Text>
              </CircularProgress>
              <View style={styles.statsGrid}>
                <View style={styles.statsGridItem}>
                  <Text category="h10" status="placeholder">
                    {t('more:roadmap_current_step', { defaultValue: 'Current Step' })}
                  </Text>
                  <Text category="h8" bold mt={2}>
                    {currentStep ? currentStep.order : (roadmap.isComplete ? roadmap.totalCount : '—')}
                  </Text>
                </View>
                <View style={styles.statsGridItem}>
                  <Text category="h10" status="placeholder">
                    {t('more:roadmap_completed_steps', { defaultValue: 'Completed' })}
                  </Text>
                  <Text category="h8" bold mt={2}>
                    {t('more:roadmap_completed_of_total', {
                      defaultValue: '{{completed}} of {{total}}',
                      completed: roadmap.completedCount,
                      total: roadmap.totalCount,
                    })}
                  </Text>
                </View>
                <View style={styles.statsGridItem}>
                  <Text category="h10" status="placeholder">
                    {t('more:roadmap_streak', { defaultValue: 'Streak' })}
                  </Text>
                  <Text category="h8" bold mt={2}>
                    {t('more:roadmap_streak_days', { defaultValue: '{{count}} Days', count: streak?.streakDays ?? 0 })}
                  </Text>
                </View>
                <View style={styles.statsGridItem}>
                  <Text category="h10" status="placeholder">
                    {t('more:roadmap_total_steps', { defaultValue: 'Total Steps' })}
                  </Text>
                  <Text category="h8" bold mt={2}>{roadmap.totalCount}</Text>
                </View>
              </View>
            </View>

            {roadmap.isComplete ? (
              // Plain success-tinted card (gradient fill removed — reserved
              // for the homescreen XP card only). Reverted to the
              // pre-reskin semantic: status="success" text/icon on a
              // color-success-transparent-200 fill.
              <View style={[styles.completeBanner, styles.completeBannerInner]}>
                <Icon pack="eva" name="award-outline" style={[globalStyle.icon20, { tintColor: 'color-success-500' }]} />
                <Text category="h9" bold status="success" style={{ marginLeft: 10, flex: 1 }}>
                  {t('more:roadmap_all_complete', {
                    defaultValue: "You've reached every milestone toward {{role}}!",
                    role: roadmap.targetRole,
                  })}
                </Text>
              </View>
            ) : null}

            <View style={styles.timeline}>
              {/* "Today" — a fixed starting marker, not a real step (nothing
                  to complete or track), just where the road begins. */}
              <View style={styles.timelineRow}>
                <View style={styles.timelineIndicatorCol}>
                  <View style={[styles.timelineDot, { backgroundColor: theme['color-basic-transparent-200'], borderColor: theme['text-hint-color'] }]}>
                    <Icon pack="eva" name="pin-outline" style={[globalStyle.icon16, { tintColor: theme['text-hint-color'] }]} />
                  </View>
                  <View style={[styles.timelineLine, { backgroundColor: theme['border-basic-color-3'] }]} />
                </View>
                <View style={[styles.timelineContent, { paddingBottom: 20 }]}>
                  <Text category="h9" bold status="placeholder">
                    {t('more:roadmap_today', { defaultValue: 'Today' })}
                  </Text>
                </View>
              </View>

              {roadmap.steps.map((step, i) => {
                const isLast = i === roadmap.steps.length - 1;
                const color = statusColor(step.status);
                const iconName = isLast ? 'award-outline' : ICONS_BY_TYPE[step.type] || 'flag-outline';
                const isCompletingThis = completingOrder === step.order;
                return (
                  <View key={step.order} style={styles.timelineRow}>
                    <View style={styles.timelineIndicatorCol}>
                      <View style={[
                        styles.timelineDot,
                        { borderColor: color },
                        step.status !== 'locked' ? { backgroundColor: color } : null,
                      ]}>
                        <Icon
                          pack="eva"
                          name={step.status === 'locked' ? 'lock-outline' : (step.status === 'completed' ? 'checkmark-outline' : iconName)}
                          style={[globalStyle.icon16, { tintColor: step.status !== 'locked' ? theme['color-basic-100'] : theme['text-hint-color'] }]}
                        />
                      </View>
                      {!isLast ? (
                        <View style={[styles.timelineLine, { backgroundColor: step.status === 'completed' ? theme['color-success-500'] : theme['border-basic-color-3'] }]} />
                      ) : null}
                    </View>
                    <View style={[styles.timelineContent, styles.stepCard, { marginBottom: isLast ? 0 : 12 }]}>
                      <Text category="h9" bold status={step.status === 'locked' ? 'placeholder' : 'basic'}>
                        {step.title}
                      </Text>
                      <Text category="h10" status="placeholder" mt={2} mb={step.status === 'current' ? 10 : 0}>
                        {step.description}
                      </Text>
                      {step.status === 'current' ? (
                        <Button
                          size="small"
                          status="primary"
                          disabled={completingOrder != null}
                          onPress={() => onCompleteStep(step.order)}
                        >
                          {isCompletingThis
                            ? () => <Spinner size="small" status="control" />
                            : t('more:roadmap_mark_complete', { defaultValue: 'Mark complete' })}
                        </Button>
                      ) : step.status === 'completed' ? (
                        <Text category="h10" status="success" bold mt={4}>
                          {t('more:completed', { defaultValue: 'Completed' })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* HOME REDESIGN follow-through — reference screenshot 2's
                "Milestone Overview" grid, grouped by real RoadmapStepType
                (see TYPE_META/milestoneGroups above) instead of the
                reference's fabricated "Week 1-4" buckets. Reuses
                StatMiniCard, same pastel-tile pattern Home's Roadmap
                Progress/Current Streak pair already established. */}
            {milestonePairs.length > 0 ? (
              <View style={styles.milestoneSection}>
                <Text category="h8" bold mb={12}>
                  {t('more:roadmap_milestone_overview', { defaultValue: 'Milestone Overview' })}
                </Text>
                {milestonePairs.map((pair, i) => (
                  <Flex key={i} justify="space-between" mt={i === 0 ? 0 : 12}>
                    {pair.map((group, j) => (
                      <StatMiniCard
                        key={group.type}
                        icon={TYPE_META[group.type].icon}
                        iconTint={TYPE_META[group.type].tint}
                        title={t(`more:roadmap_type_${group.type}`, { defaultValue: TYPE_META[group.type].label })}
                        value={t('more:roadmap_completed_of_total', {
                          defaultValue: '{{completed}} of {{total}}',
                          completed: group.completed,
                          total: group.total,
                        })}
                        valueColor={TYPE_META[group.type].tint}
                        caption={t('more:roadmap_type_caption', {
                          defaultValue: '{{completed}} of {{total}} steps complete',
                          completed: group.completed,
                          total: group.total,
                        })}
                        progressPercent={group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0}
                        progressColor={TYPE_META[group.type].tint}
                        backgroundColor={TYPE_META[group.type].bg}
                        style={j === 0 && pair.length > 1 ? { marginRight: 12 } : undefined}
                      />
                    ))}
                  </Flex>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </Content>

      <Modal visible={formSheetVisible} animationType="slide" transparent onRequestClose={() => setFormSheetVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeaderRow}>
              <Text category="h7" bold>
                {t('more:roadmap_build_cta', { defaultValue: 'Plan my roadmap' })}
              </Text>
              <TouchableOpacity onPress={() => setFormSheetVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon pack="eva" name="close-outline" style={[globalStyle.icon24, { tintColor: theme['text-basic-color'] }]} />
              </TouchableOpacity>
            </View>
            <Text category="h10" status="placeholder" mb={6}>
              {t('more:roadmap_target_role_label', { defaultValue: 'Role you want' })}
            </Text>
            <Input
              placeholder={t('more:roadmap_target_role_placeholder', { defaultValue: 'e.g. Senior Backend Engineer' })}
              value={targetRole}
              onChangeText={setTargetRole}
              style={[styles.input, { marginBottom: 16 }]}
              textStyle={globalStyle.inputText}
            />
            <Text category="h10" status="placeholder" mb={6}>
              {t('more:roadmap_current_role_label', { defaultValue: 'Your current role (optional)' })}
            </Text>
            <Input
              placeholder={t('more:roadmap_current_role_placeholder', { defaultValue: 'e.g. Backend Engineer' })}
              value={currentRole}
              onChangeText={setCurrentRole}
              style={styles.input}
              textStyle={globalStyle.inputText}
            />
            <CtaButton
              style={[globalStyle.shadowBtn, { marginTop: 20 }]}
              disabled={!targetRole.trim() || isGenerating}
              onPress={onGenerate}
            >
              {isGenerating
                ? () => <Spinner size="small" status="control" />
                : t('more:roadmap_build_cta', { defaultValue: 'Plan my roadmap' })}
            </CtaButton>
          </View>
        </View>
      </Modal>
    </Container>
  );
});

export default CareerRoadmap;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { ...globalStyle.inputField },
  // Same Modal/backdrop/sheet idiom as components/DocumentPickerModal.tsx
  // and Chat.tsx's topicsSheet — see formSheetVisible's own comment above.
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'background-basic-color-2',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  // Plain success-tinted card (gradient fill removed).
  completeBanner: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: 'color-success-transparent-200',
  },
  completeBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  // Donut + 2x2 stat-grid header (see the statsCard JSX above for what
  // each tile shows). COLOR HISTORY: shadow only -> shadow + hairline
  // border (globalStyle.cardBorder) -> product follow-up ("give this
  // card a box shadow and remove the border") -- back to shadow only,
  // same globalStyle.card every other neutral card in this app uses.
  statsCard: {
    ...globalStyle.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 20,
  },
  statsRing: {
    marginRight: 18,
  },
  statsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsGridItem: {
    width: '50%',
    marginBottom: 12,
  },
  // "Card row" timeline step (reference screenshot 2's white row-per-day
  // cards) -- the connecting dotted/solid line + circular status dot
  // still live in timelineIndicatorCol, outside this box, same as before.
  stepCard: {
    ...globalStyle.card,
    padding: 12,
    shadowOpacity: 0,
    elevation: 0,
  },
  milestoneSection: {
    marginTop: 28,
  },
  timeline: {
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineIndicatorCol: {
    width: 32,
    alignItems: 'center',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    marginLeft: 14,
  },
});
