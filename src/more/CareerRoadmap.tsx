import React, { memo } from 'react';
import { View } from 'react-native';
import {
  TopNavigation,
  StyleService,
  useStyleSheet,
  useTheme,
  Layout,
  Button,
  Input,
  Icon,
  Spinner,
} from '@ui-kitten/components';
import { useTranslation } from 'react-i18next';

import Text from 'components/Text';
import Content from 'components/Content';
import Container from 'components/Container';
import Flex from 'components/Flex';
import NavigationAction from 'components/NavigationAction';
import { globalStyle } from 'styles/globalStyle';
import { AuthContext } from '../../AuthContext';
import ProLockGate from 'components/ProLockGate';
import * as roadmapService from 'services/roadmapService';
import { CareerRoadmap as CareerRoadmapPlan, RoadmapStep, RoadmapStepType } from 'services/roadmapService';
import CtaButton from 'components/CtaButton';

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

  const [targetRole, setTargetRole] = React.useState('');
  const [currentRole, setCurrentRole] = React.useState('');
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [roadmap, setRoadmap] = React.useState<CareerRoadmapPlan | null>(null);
  const [roadmapLoaded, setRoadmapLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Which step's "Mark complete" call is currently in flight — disables
  // just that button (not the whole screen) and swaps its label for a
  // spinner while the request is out.
  const [completingOrder, setCompletingOrder] = React.useState<number | null>(null);

  React.useEffect(() => {
    roadmapService.getSavedRoadmap()
      .then(setRoadmap)
      .finally(() => setRoadmapLoaded(true));
  }, []);

  const onGenerate = async () => {
    const role = targetRole.trim();
    if (!role || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const plan = await roadmapService.generateRoadmap(role, currentRole.trim());
      setRoadmap(plan);
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

  // Everyone lands here with an orientation roadmap already built from the
  // goal/role they gave at signup (see app/services/career_roadmap_service.py's
  // ensure_auto_roadmap, wired into users.py's update_me) -- this screen used
  // to hard-gate on isPremium before even checking whether a roadmap existed,
  // which meant a free user who already had one auto-generated for them could
  // never actually see it. The Pro gate now only applies to the MANUAL
  // "build one yourself" flow below (no saved roadmap yet, e.g. a social-login
  // signup that skipped the goal/role step) -- matched to the same tier as
  // the other "AI plans your path" features (Curriculum Builder/Learning
  // Courses). See entitlements_service.py's module docstring for the full
  // breakdown this mirrors.
  if (!roadmapLoaded) {
    return (
      <Container style={styles.container}>
        <TopNavigation
          title={t('more:career_roadmap', { defaultValue: 'AI Career Roadmap' })}
          accessoryLeft={<NavigationAction />}
        />
        <Flex center style={globalStyle.flexOne}><Spinner size="large" /></Flex>
      </Container>
    );
  }

  if (!roadmap && !isPremium) {
    return (
      <ProLockGate
        variant="premium"
        title={t('more:career_roadmap', { defaultValue: 'AI Career Roadmap' })}
        description={t('more:career_roadmap_pro_gate_description', {
          defaultValue: 'Tell the AI the role you want and it plans the real, step-by-step path to get there — a Pro Premium feature.',
        })}
      />
    );
  }

  return (
    <Container style={styles.container}>
      <TopNavigation
        title={t('more:career_roadmap', { defaultValue: 'AI Career Roadmap' })}
        accessoryLeft={<NavigationAction />}
      />
      <Content padder avoidKeyboard contentContainerStyle={styles.content}>
        <Text category="h9-s" status="placeholder" mb={20}>
          {t('more:career_roadmap_description', {
            defaultValue: 'Tell the AI the role you want, and it plans the real path to get there — skills to learn, things to build, and the interview that lands it.',
          })}
        </Text>

        {error ? <Text category="h9-s" status="danger" mb={16} center>{error}</Text> : null}

        {roadmapLoaded && !roadmap ? (
          <Layout level="2" style={styles.formCard}>
            <Text category="h10" status="placeholder" mb={6}>
              {t('more:roadmap_target_role_label', { defaultValue: 'Role you want' })}
            </Text>
            <Input
              placeholder={t('more:roadmap_target_role_placeholder', { defaultValue: 'e.g. Senior Backend Engineer' })}
              value={targetRole}
              onChangeText={setTargetRole}
              style={[styles.input, { marginBottom: 16 }]}
            />
            <Text category="h10" status="placeholder" mb={6}>
              {t('more:roadmap_current_role_label', { defaultValue: 'Your current role (optional)' })}
            </Text>
            <Input
              placeholder={t('more:roadmap_current_role_placeholder', { defaultValue: 'e.g. Backend Engineer' })}
              value={currentRole}
              onChangeText={setCurrentRole}
              style={styles.input}
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
          </Layout>
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

            {roadmap.isComplete ? (
              // Two layers, not one (product bug: "extra white card behind"
              // on Android, fine on iOS) — see HomeSrc.tsx's
              // checkInCardOuter/checkInCardInner for the full explanation.
              <View style={styles.completeBannerOuter}>
                <View style={styles.completeBanner}>
                  <Icon pack="eva" name="award-outline" style={[globalStyle.icon20, { tintColor: theme['text-basic-color'] }]} />
                  <Text category="h9" bold status="success" style={{ marginLeft: 8, flex: 1 }}>
                    {t('more:roadmap_all_complete', {
                      defaultValue: "You've reached every milestone toward {{role}}!",
                      role: roadmap.targetRole,
                    })}
                  </Text>
                </View>
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
                    <View style={[styles.timelineContent, { paddingBottom: isLast ? 0 : 24 }]}>
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
          </View>
        ) : null}
      </Content>
    </Container>
  );
});

export default CareerRoadmap;

const themedStyles = StyleService.create({
  container: { flex: 1 },
  content: { paddingBottom: 80 },
  input: { borderRadius: 12 },
  formCard: {
    ...globalStyle.card,
    borderRadius: 20,
    padding: 20,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  // Split in two (product bug: "extra white card behind" on Android) — see
  // the JSX comment above where these are used.
  completeBannerOuter: {
    ...globalStyle.card,
    marginBottom: 20,
    // Was opaque (needed back when `card` still carried Android elevation
    // — see HomeSrc.tsx's checkInCardOuter for the full explanation).
    // `card` is border-only now, so transparent is safe and matches the
    // app-wide "cards are transparent" pass.
    backgroundColor: 'transparent',
  },
  completeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'color-success-transparent-200',
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
